/**
 * pages/api/affiliate-video.ts
 * AI Video Generation API using @google/genai (Veo 3 / Veo 2).
 *
 * POST /api/affiliate-video  – Start generation, poll until done, return videos.
 * GET  /api/affiliate-video?operationName=...&apiKey=... – Poll a running operation.
 *
 * Uses @google/genai SDK's generateVideos() with long-running operation polling.
 */
import { GoogleGenAI } from "@google/genai";
import type { NextApiRequest, NextApiResponse } from "next";

// ── Request / Response types ───────────────────────────────────────────────
export interface GenerateVideoRequest {
  apiKey: string;
  /** Main text prompt for the video */
  mainPrompt: string;
  /** Optional style reference prompt appended to mainPrompt */
  stylePrompt?: string;
  /** Input images for image-to-video (first one used as start frame) */
  inputImages?: { src: string; prompt: string; mediaType: "image" | "video" }[];
  /** Dialogue lines to embed in the prompt */
  dialogueLines?: { start: number; end: number; text: string; voice: string }[];
  /** Video generation configuration */
  config: {
    model: string;
    duration: number;
    aspectRatio: string;
    numberOfOutputs: number;
    personGeneration: "allow_adult" | "dont_allow";
    generateSubtitles: boolean;
  };
}

export interface GenerateVideoResponse {
  success: boolean;
  /** Array of base64 data URLs (video/mp4) */
  videos?: string[];
  error?: string;
}

// ── Utility: convert data URL or http URL to base64 ───────────────────────
async function toBase64(src: string): Promise<{ data: string; mimeType: string }> {
  if (src.startsWith("data:")) {
    const [header, data] = src.split(",");
    const mimeType = header.match(/:(.*?);/)?.[1] || "image/jpeg";
    return { data, mimeType };
  }
  const resp = await fetch(src);
  const buf = await resp.arrayBuffer();
  return {
    data: Buffer.from(buf).toString("base64"),
    mimeType: resp.headers.get("content-type") || "image/jpeg",
  };
}

// ── Utility: sleep ─────────────────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main Handler ───────────────────────────────────────────────────────────
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<GenerateVideoResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed. Use POST." });
  }

  const body: GenerateVideoRequest = req.body;
  const { apiKey, mainPrompt, stylePrompt, inputImages, dialogueLines, config } = body;

  // ── Validate ─────────────────────────────────────────────────────────────
  if (!apiKey) {
    return res
      .status(400)
      .json({ success: false, error: "Gemini API key is required. Please add it in Settings." });
  }
  if (!mainPrompt?.trim()) {
    return res.status(400).json({ success: false, error: "Main prompt is required." });
  }

  try {
    // ── Build full prompt ──────────────────────────────────────────────────
    let fullPrompt = mainPrompt.trim();

    // Append style reference
    if (stylePrompt?.trim()) {
      fullPrompt += `\n\nStyle: ${stylePrompt.trim()}`;
    }

    // Embed dialogue / subtitle lines into prompt
    if (dialogueLines && dialogueLines.length > 0) {
      fullPrompt += "\n\nDialogue/Subtitles:";
      dialogueLines.forEach((line) => {
        fullPrompt += `\n[${line.start}s–${line.end}s] (${line.voice} voice): "${line.text}"`;
      });
      fullPrompt += "\nPlease generate correct subtitles at the specified timecodes.";
    }

    console.log("[affiliate-video] Model:", config.model, "| Duration:", config.duration, "s");
    console.log("[affiliate-video] Prompt:", fullPrompt.slice(0, 200));

    // ── Set up @google/genai client ────────────────────────────────────────
    const ai = new GoogleGenAI({ apiKey });

    // ── Build generation params ────────────────────────────────────────────
    const genParams: Record<string, any> = {
      model: config.model,
      prompt: fullPrompt,
      config: {
        numberOfVideos: Math.min(Math.max(1, config.numberOfOutputs), 4), // Veo max 4
        durationSeconds: config.duration,
        aspectRatio: config.aspectRatio,
        personGeneration: config.personGeneration,
        generateSubtitles: config.generateSubtitles,
      },
    };

    // If input images provided, use the first one as the start frame (image-to-video)
    if (inputImages && inputImages.length > 0 && inputImages[0].src) {
      const firstInput = inputImages.find((i) => i.mediaType === "image" && i.src);
      if (firstInput && firstInput.src) {
        const { data, mimeType } = await toBase64(firstInput.src);
        genParams.image = { imageBytes: data, mimeType };
      }
    }

    // ── Start video generation (Veo long-running operation) ────────────────
    let operation = await (ai.models as any).generateVideos(genParams);

    // ── Poll until done (max 8 minutes) ───────────────────────────────────
    const MAX_WAIT_MS = 8 * 60 * 1000;
    const POLL_INTERVAL_MS = 8000;
    let elapsed = 0;

    while (!operation.done && elapsed < MAX_WAIT_MS) {
      await sleep(POLL_INTERVAL_MS);
      elapsed += POLL_INTERVAL_MS;
      console.log(`[affiliate-video] Polling... ${Math.round(elapsed / 1000)}s elapsed`);
      operation = await (ai.operations as any).getVideosOperation({ operation });
    }

    if (!operation.done) {
      return res.status(408).json({
        success: false,
        error: "Video generation timed out (8 min). Try a shorter duration.",
      });
    }

    // ── Extract video results ──────────────────────────────────────────────
    const samples = operation.response?.generatedSamples ?? [];
    if (!samples.length) {
      console.error("[affiliate-video] No generated samples:", JSON.stringify(operation.response));
      return res.status(500).json({
        success: false,
        error: "No videos were generated. Check your prompt and API quota.",
      });
    }

    const videos: string[] = [];
    for (const sample of samples) {
      const vid = sample.video;
      if (vid?.videoBytes) {
        // base64 bytes → data URL
        videos.push(`data:video/mp4;base64,${vid.videoBytes}`);
      } else if (vid?.uri) {
        // GCS URI – return as-is (client will open directly or proxy)
        videos.push(vid.uri);
      }
    }

    return res.status(200).json({ success: true, videos });
  } catch (err: any) {
    console.error("[affiliate-video] Error:", err);
    const message = err?.message || "Video generation failed.";
    // Provide friendly error messages for common failures
    if (message.includes("403") || message.includes("PERMISSION_DENIED")) {
      return res.status(403).json({
        success: false,
        error: `API key không có quyền truy cập Veo. Veo 3 cần tài khoản được duyệt. Chi tiết: ${message}`,
      });
    }
    if (message.includes("quota") || message.includes("RESOURCE_EXHAUSTED")) {
      return res.status(429).json({
        success: false,
        error: `Hết quota API. Vui lòng thử lại sau. Chi tiết: ${message}`,
      });
    }
    return res.status(500).json({ success: false, error: message });
  }
}

export const config = {
  api: {
    bodyParser: { sizeLimit: "100mb" },
    // Allow long-running video generation (local dev – no strict timeout)
    responseLimit: false,
  },
};
