/**
 * Chuẩn hóa response từ các AI provider (Gemini, OpenAI, Claude, ...)
 * thành resultRefs (upload ảnh/video lên MinIO, tạo Attachment) và responseSummary.
 * Dùng chung cho queue worker sau khi gọi executeByProvider.
 */

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

/**
 * Trích ảnh từ response Gemini (generateContent với responseModalities IMAGE).
 * candidates[].content.parts[].inlineData có mimeType + data (base64).
 */
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
        parts.push({
          data: id.data,
          mimeType: id.mimeType || "image/png",
        });
      }
    }
  }
  return parts;
}

/**
 * Chuẩn hóa response từ API AI thành resultRefs (đã upload) và responseSummary.
 * @param runId - Id của AiGenerationRun (để đặt path MinIO)
 * @param provider - Provider key
 * @param outputType - IMAGE | VIDEO | FILE | AUDIO
 * @param rawResponse - Object trả về từ executeByProvider
 */
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

  if (outputType === ApiOutputTypeEnum.IMAGE) {
    if (provider === AiProviderKeyEnum.GOOGLE_GEMINI_KEY) {
      const parts = extractGeminiImageParts(raw);
      for (let i = 0; i < parts.length; i++) {
        const buf = Buffer.from(parts[i].data, "base64");
        const ref = await uploadBufferAndCreateRef(runId, buf, parts[i].mimeType, "image", i + 1);
        resultRefs.push(ref);
      }
    }
    // Có thể mở rộng: OPENAI_KEY trả về data[].url hoặc b64_json, CLAUDE_KEY tương tự.
  }

  if (outputType === ApiOutputTypeEnum.VIDEO) {
    // Gemini video trả về operation (name, done, response, error). Nếu đã poll xong, response có thể chứa URL.
    const videoResponse = raw.response as Record<string, unknown> | undefined;
    const videos =
      (videoResponse?.videos as Array<{ url?: string }>) ||
      (videoResponse?.video as Array<{ url?: string }>) ||
      [];
    if (Array.isArray(videos) && videos.length > 0) {
      for (let i = 0; i < videos.length; i++) {
        const url = videos[i]?.url;
        if (typeof url === "string") {
          resultRefs.push({ type: "video", url, order: i + 1 });
        }
      }
    }
    // Nếu chưa có URL (operation chưa xong), resultRefs để trống; responseSummary lưu raw để sau poll.
  }

  const responseSummary: ResponseSummary = {
    outputCount: resultRefs.length,
    usageMetadata: raw.usageMetadata as Record<string, unknown> | undefined,
    model: undefined,
  };

  return { resultRefs, responseSummary };
}
