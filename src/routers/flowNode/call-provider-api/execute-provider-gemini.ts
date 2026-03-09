/**
 * Google Gemini API – dùng thư viện @google/genai (GoogleGenAI) cho tạo ảnh và video.
 * Tài liệu:
 * - Ảnh: https://ai.google.dev/gemini-api/docs/image-generation
 * - Video: https://ai.google.dev/gemini-api/docs/video
 *
 * Chọn API theo ctx.outputType (IMAGE | VIDEO).
 */

import { GoogleGenAI, Modality } from "@google/genai";
import axios from "axios";
import { ApiOutputTypeEnum } from "../../../libs/dal/product";
import { ExecuteProviderContext } from "../execute-provider";

/** Entry: chọn API ảnh hoặc video theo outputType, mặc định gọi generateContent. */
export async function CallProviderGeminiApi(ctx: ExecuteProviderContext): Promise<unknown> {
  const apiKey = ctx.credentialDecrypted;
  if (!apiKey?.trim()) {
    throw new Error("Google Gemini API key is required (credentialDecrypted).");
  }

  const ai = new GoogleGenAI({ apiKey });

  if (ctx.outputType === ApiOutputTypeEnum.IMAGE) {
    return callGeminiImageGenerationApi(ai, ctx);
  }
  if (ctx.outputType === ApiOutputTypeEnum.VIDEO) {
    return callGeminiVideoGenerationApi(ai, ctx);
  }
  return callGeminiGenerateContentGeneric(ai, ctx);
}

/**
 * Tạo ảnh bằng Gemini Image Generation.
 * Gọi models.generateContent với config.responseModalities = [TEXT, IMAGE].
 * Ref: https://ai.google.dev/gemini-api/docs/image-generation
 */
async function callGeminiImageGenerationApi(
  ai: GoogleGenAI,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const { body, fieldValues } = ctx;
  const model = getModelFromContext(ctx, "gemini-2.5-flash-preview-05-20");
  const prompt = extractPromptFromBody(body);
  const convertedImages = await loadReferenceImagesFromFieldValues(fieldValues);

  const parts: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> = [
    { text: prompt },
  ];
  for (const img of convertedImages) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64Data },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
    config: {
      responseModalities: [Modality.TEXT, Modality.IMAGE],
    },
  });

  return serializeGenerateContentResponse(response);
}

/**
 * Tạo video bằng Veo (Gemini Video Generation).
 * Gọi models.generateVideos, trả về operation; có thể poll bằng operations.getVideosOperation.
 * Ref: https://ai.google.dev/gemini-api/docs/video
 */
async function callGeminiVideoGenerationApi(
  ai: GoogleGenAI,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const { body, fieldValues } = ctx;
  const model = getModelFromContext(ctx, "veo-2.0-generate-001");
  const prompt = extractPromptFromBody(body);
  const convertedImages = await loadReferenceImagesFromFieldValues(fieldValues);

  const bodyObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const config = {
    numberOfVideos: (bodyObj.numberOfVideos as number) ?? (bodyObj.sampleCount as number) ?? 1,
  };

  // Gemini generateVideos: "source" và "prompt/image/video" loại trừ lẫn nhau — chỉ dùng một.
  const params: {
    model: string;
    prompt?: string;
    source?: { prompt?: string; image?: { imageBytes?: string; mimeType?: string } };
    config?: { numberOfVideos?: number };
  } = {
    model,
    config,
  };

  if (convertedImages.length > 0) {
    params.source = {
      prompt,
      image: {
        imageBytes: convertedImages[0].base64Data,
        mimeType: convertedImages[0].mimeType,
      },
    };
  } else {
    params.prompt = prompt;
  }

  const operation = await ai.models.generateVideos(params);

  return serializeVideoOperation(operation);
}

/**
 * Gọi generateContent chung (text + ảnh đầu vào), không chỉ định responseModalities.
 * Dùng khi outputType khác IMAGE/VIDEO hoặc chỉ cần chat/phân tích ảnh.
 */
async function callGeminiGenerateContentGeneric(
  ai: GoogleGenAI,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const { body, fieldValues } = ctx;
  const model = getModelFromContext(ctx, "gemini-2.5-flash");
  const prompt = extractPromptFromBody(body);
  const convertedImages = await loadReferenceImagesFromFieldValues(fieldValues);

  const parts: Array<{ text?: string; inlineData?: { mimeType?: string; data?: string } }> = [
    { text: prompt },
  ];
  for (const img of convertedImages) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64Data },
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts }],
  });

  return serializeGenerateContentResponse(response);
}

/** Lấy tên model từ node config hoặc từ URL (path chứa models/xxx), fallback defaultModel. */
function getModelFromContext(ctx: ExecuteProviderContext, defaultModel: string): string {
  const configModel = ctx.nodeData?.config?.model;
  if (typeof configModel === "string" && configModel.trim()) return configModel.trim();
  const fromUrl = extractModelFromUrl(ctx.url);
  if (fromUrl) return fromUrl;
  return defaultModel;
}

/** Trích model name từ URL dạng .../models/{model}:generateContent hoặc .../models/{model}. */
function extractModelFromUrl(url: string): string | null {
  if (!url || typeof url !== "string") return null;
  const match = url.match(/\/models\/([^/:]+)/);
  return match ? match[1] : null;
}

/** Chuyển response generateContent sang object thuần (để trả JSON). */
function serializeGenerateContentResponse(response: unknown): Record<string, unknown> {
  const r = response as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (r.candidates != null) out.candidates = r.candidates;
  if (r.usageMetadata != null) out.usageMetadata = r.usageMetadata;
  if (r.text !== undefined) out.text = r.text;
  if (r.data !== undefined) out.data = r.data;
  return out;
}

/** Chuyển GenerateVideosOperation sang object thuần (name, done, response, error). */
function serializeVideoOperation(operation: unknown): Record<string, unknown> {
  const o = operation as Record<string, unknown>;
  return {
    name: o.name,
    done: o.done,
    response: o.response,
    error: o.error,
  };
}

/** Lấy chuỗi prompt từ body (string hoặc object có .prompt / .contents). */
function extractPromptFromBody(body: unknown): string {
  if (typeof body === "string" && body.trim()) return body.trim();
  if (typeof body === "object" && body !== null) {
    const obj = body as Record<string, unknown>;
    if (typeof obj.prompt === "string") return (obj.prompt as string).trim();
    const contents = obj.contents;
    if (Array.isArray(contents) && contents.length > 0) {
      const firstContent = contents[0] as Record<string, unknown> | undefined;
      const parts = firstContent?.parts as Array<{ text?: string }> | undefined;
      const firstPart = parts?.[0];
      if (firstPart && typeof firstPart.text === "string") return firstPart.text.trim();
    }
  }
  return typeof body === "string" ? body : "";
}

/** Thu thập URL ảnh từ fieldValues, tải và convert sang base64 (ảnh tham chiếu). */
async function loadReferenceImagesFromFieldValues(
  fieldValues: Record<string, unknown>
): Promise<{ base64Data: string; mimeType: string }[]> {
  const imageUrls = collectImageUrlsFromFieldValues(fieldValues);
  if (imageUrls.length === 0) return [];
  try {
    return await Promise.all(imageUrls.map(convertImageUrlToBase64));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to load images: ${message}`);
  }
}

/** Kiểm tra giá trị có phải URL ảnh (http/https) hay không. */
function isImageUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return /^https?:\/\//i.test(value.trim());
}

/** Đệ quy thu thập mọi URL ảnh trong object (string, mảng, object lồng nhau). */
function collectImageUrlsFromFieldValues(fieldValues: Record<string, unknown>): string[] {
  const urls: string[] = [];
  function walk(obj: unknown): void {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (isImageUrl(item)) urls.push(item.trim());
        else if (typeof item === "object" && item !== null) walk(item);
      }
      return;
    }
    if (typeof obj === "object") {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (isImageUrl(value)) urls.push(value.trim());
        else if (Array.isArray(value) || (typeof value === "object" && value !== null)) walk(value);
      }
    }
  }
  walk(fieldValues);
  return urls;
}

/** Tải ảnh từ URL và chuyển thành base64 + mimeType. */
async function convertImageUrlToBase64(
  url: string
): Promise<{ base64Data: string; mimeType: string }> {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    timeout: 30000,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    },
  });
  const base64Data = Buffer.from(response.data).toString("base64");
  const mimeType = response.headers["content-type"] || "image/jpeg";
  return { base64Data, mimeType };
}
