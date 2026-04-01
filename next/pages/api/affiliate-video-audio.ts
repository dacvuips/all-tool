/**
 * pages/api/affiliate-video-audio.ts
 * Gemini Native Speech (TTS) – sinh audio từ text prompt.
 * POST /api/affiliate-video-audio
 * Model: gemini-2.5-flash-preview-tts
 */
import type { NextApiRequest, NextApiResponse } from "next";
import { GoogleGenAI } from "@google/genai";

export interface AudioGenerateRequest {
  apiKey: string;
  text: string;
  voiceName?: string;
}

export interface AudioGenerateResponse {
  success: boolean;
  /** base64 PCM / wav audio data URL */
  audioDataUrl?: string;
  error?: string;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<AudioGenerateResponse>
) {
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  const body: AudioGenerateRequest = req.body;
  const { apiKey, text, voiceName = "Aoede" } = body;

  if (!apiKey) return res.status(400).json({ success: false, error: "Cần Gemini API key" });
  if (!text?.trim()) return res.status(400).json({ success: false, error: "Cần nhập text để tạo audio" });

  try {
    const ai = new GoogleGenAI({ apiKey });

    const response = await (ai.models as any).generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text.trim() }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    // Extract audio data from response
    const candidates = response?.candidates ?? [];
    let audioBase64: string | null = null;
    let mimeType = "audio/wav";

    for (const candidate of candidates) {
      const parts = candidate?.content?.parts ?? [];
      for (const part of parts) {
        if (part.inlineData?.data) {
          audioBase64 = part.inlineData.data;
          mimeType = part.inlineData.mimeType || "audio/wav";
          break;
        }
      }
      if (audioBase64) break;
    }

    if (!audioBase64) {
      console.error("[affiliate-video-audio] No audio data in response:", JSON.stringify(response).slice(0, 500));
      throw new Error("Gemini không trả về dữ liệu audio");
    }

    const audioDataUrl = `data:${mimeType};base64,${audioBase64}`;
    return res.status(200).json({ success: true, audioDataUrl });

  } catch (err: any) {
    console.error("[affiliate-video-audio] Error:", err);
    return res.status(500).json({ success: false, error: err.message || "Lỗi tạo audio" });
  }
}
