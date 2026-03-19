/**
 * Chuẩn hóa response từ các AI provider thành resultRefs (upload MinIO) và responseSummary.
 * Dùng chung cho queue worker sau khi gọi executeByProvider.
 *
 * Response formats:
 * - GOOGLE_GEMINI_KEY (SDK) IMAGE: { candidates[].content.parts[].inlineData.{data,mimeType} }
 * - GOOGLE_GEMINI_KEY (SDK) VIDEO: { done, response.generatedVideos[].video.{uri,videoBytes,mimeType} }
 * - GOOGLE_GEMINI_KEY (Vertex) IMAGE: { predictions[].bytesBase64Encoded, predictions[].mimeType }
 * - GOOGLE_GEMINI_KEY (Vertex) VIDEO: { predictions[].bytesBase64Encoded } hoặc operation-based
 */

import axios from "axios";
import logger from "../../../helpers/logger";
import minio from "../../../helpers/minio";
import type { GenerationOutputRef, ResponseSummary } from "../../../libs/dal/aiGenerationRun";
import { attachmentService } from "../../../libs/dal/attachment";
import { AiProviderKeyEnum, ApiOutputTypeEnum } from "../../../libs/dal/product";

const BUCKET_PREFIX = "images/ai-generation";

/**
 * Upload buffer lên MinIO và tạo bản ghi Attachment.
 * Trả về GenerationOutputRef để push vào resultRefs.
 */
async function uploadBufferAndCreateRef(
  runId: string,
  buffer: Buffer,
  mimeType: string,
  type: "image" | "video" | "file" | "audio",
  order: number
): Promise<GenerationOutputRef> {
  const ext =
    mimeType.split("/")[1] || (type === "image" ? "png" : type === "video" ? "mp4" : "bin");
  const fileName = `${BUCKET_PREFIX}/${runId}/${order}.${ext}`;

  const result = await minio.uploadBuffer(fileName, buffer, mimeType, { isPublic: true });

  const attachment = await attachmentService.create({
    bucket: result.bucket,
    name: result.name,
    path: result.name,
    mimetype: result.mimetype,
    size: result.size,
    etag: result.etag,
  });

  return {
    type,
    attachmentId: (attachment as any)._id?.toString(),
    url: result.link,
    mimeType: result.mimetype,
    size: result.size,
    order,
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Gemini SDK extractors
 * ═══════════════════════════════════════════════════════════════════════════ */

function extractGeminiImageParts(
  raw: Record<string, unknown>
): { data: string; mimeType: string }[] {
  const parts: { data: string; mimeType: string }[] = [];
  const candidates = raw.candidates as
    | Array<{ content?: { parts?: Array<{ inlineData?: { data?: string; mimeType?: string } }> } }>
    | undefined;
  if (!Array.isArray(candidates)) return parts;
  for (const c of candidates) {
    const partList = c.content?.parts;
    if (!Array.isArray(partList)) continue;
    for (const p of partList) {
      const id = p.inlineData;
      if (id?.data) {
        parts.push({ data: id.data, mimeType: id.mimeType || "image/png" });
      }
    }
  }
  return parts;
}

function extractGeminiVideoParts(
  raw: Record<string, unknown>
): { uri?: string; videoBytes?: string; mimeType: string }[] {
  const videoResponse = raw.response as Record<string, unknown> | undefined;
  if (!videoResponse) return [];

  const generatedVideos = videoResponse.generatedVideos as
    | Array<{ video?: { uri?: string; videoBytes?: string; mimeType?: string } }>
    | undefined;
  if (!Array.isArray(generatedVideos)) return [];

  return generatedVideos
    .filter((gv) => gv.video?.uri || gv.video?.videoBytes)
    .map((gv) => ({
      uri: gv.video?.uri,
      videoBytes: gv.video?.videoBytes,
      mimeType: gv.video?.mimeType || "video/mp4",
    }));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Vertex AI REST extractors
 * Imagen IMAGE response: { predictions: [{ bytesBase64Encoded, mimeType }] }
 * Veo VIDEO response: { predictions: [{ bytesBase64Encoded, mimeType }] }
 * ═══════════════════════════════════════════════════════════════════════════ */

function extractVertexPredictions(
  raw: Record<string, unknown>,
  type: "image" | "video"
): { data: string; mimeType: string }[] {
  const predictions = raw.predictions as Array<Record<string, unknown>> | undefined;
  if (!Array.isArray(predictions)) return [];

  return predictions
    .filter((p) => typeof p.bytesBase64Encoded === "string" && p.bytesBase64Encoded)
    .map((p) => ({
      data: p.bytesBase64Encoded as string,
      mimeType:
        (p.mimeType as string) || (type === "image" ? "image/png" : "video/mp4"),
    }));
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Shared download helper
 * ═══════════════════════════════════════════════════════════════════════════ */

async function downloadMediaFromUri(uri: string): Promise<Buffer> {
  const resp = await axios.get(uri, {
    responseType: "arraybuffer",
    timeout: 120_000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  return Buffer.from(resp.data);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Main normalizer
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function normalizeAiResponse(
  runId: string,
  provider: AiProviderKeyEnum,
  outputType: ApiOutputTypeEnum,
  rawResponse: unknown
): Promise<{ resultRefs: GenerationOutputRef[]; responseSummary: ResponseSummary }> {
  const resultRefs: GenerationOutputRef[] = [];
  const raw = (rawResponse && typeof rawResponse === "object" ? rawResponse : {}) as Record<
    string,
    unknown
  >;
  const isVertex = raw._vertexProvider === true;

  /* ── IMAGE ─────────────────────────────────────────────────────────── */
  if (outputType === ApiOutputTypeEnum.IMAGE) {
    if (isVertex) {
      const predictions = extractVertexPredictions(raw, "image");
      for (let i = 0; i < predictions.length; i++) {
        const buf = Buffer.from(predictions[i].data, "base64");
        const ref = await uploadBufferAndCreateRef(
          runId, buf, predictions[i].mimeType, "image", i + 1
        );
        resultRefs.push(ref);
      }
    } else if (provider === AiProviderKeyEnum.GOOGLE_GEMINI_KEY) {
      const parts = extractGeminiImageParts(raw);
      for (let i = 0; i < parts.length; i++) {
        const buf = Buffer.from(parts[i].data, "base64");
        const ref = await uploadBufferAndCreateRef(runId, buf, parts[i].mimeType, "image", i + 1);
        resultRefs.push(ref);
      }
    }
  }

  /* ── VIDEO ─────────────────────────────────────────────────────────── */
  if (outputType === ApiOutputTypeEnum.VIDEO) {
    if (isVertex) {
      const predictions = extractVertexPredictions(raw, "video");
      for (let i = 0; i < predictions.length; i++) {
        const buf = Buffer.from(predictions[i].data, "base64");
        const ref = await uploadBufferAndCreateRef(
          runId, buf, predictions[i].mimeType, "video", i + 1
        );
        resultRefs.push(ref);
      }
    } else if (provider === AiProviderKeyEnum.GOOGLE_GEMINI_KEY) {
      const videoParts = extractGeminiVideoParts(raw);
      for (let i = 0; i < videoParts.length; i++) {
        const vp = videoParts[i];
        try {
          if (vp.videoBytes) {
            const buf = Buffer.from(vp.videoBytes, "base64");
            const ref = await uploadBufferAndCreateRef(runId, buf, vp.mimeType, "video", i + 1);
            resultRefs.push(ref);
          } else if (vp.uri) {
            const buf = await downloadMediaFromUri(vp.uri);
            const ref = await uploadBufferAndCreateRef(runId, buf, vp.mimeType, "video", i + 1);
            resultRefs.push(ref);
          }
        } catch (err) {
          logger.error(`[normalizeAiResponse] Failed to process video part ${i}`, err);
          if (vp.uri) {
            resultRefs.push({ type: "video", url: vp.uri, mimeType: vp.mimeType, order: i + 1 });
          }
        }
      }
    }

    if (resultRefs.length === 0) {
      const videoResponse = raw.response as Record<string, unknown> | undefined;
      const raiCount = videoResponse?.raiMediaFilteredCount;
      const raiReasons = videoResponse?.raiMediaFilteredReasons;
      if (raiCount || raiReasons) {
        logger.warn(
          `[normalizeAiResponse] Video RAI filtered: count=${raiCount}, reasons=${JSON.stringify(raiReasons)}`
        );
      }
    }
  }

  const responseSummary: ResponseSummary = {
    outputCount: resultRefs.length,
    usageMetadata: raw.usageMetadata as Record<string, unknown> | undefined,
    model: undefined,
  };

  return { resultRefs, responseSummary };
}
