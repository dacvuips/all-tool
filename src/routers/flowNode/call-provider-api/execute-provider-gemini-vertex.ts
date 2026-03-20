/**
 * Google Vertex AI REST API – gọi trực tiếp endpoint Vertex AI bằng fetch.
 * Hỗ trợ Gemini (text/chat), Imagen (tạo ảnh), và Veo (tạo video):
 *   0. Text/Chat (Gemini generateContent)
 *   1. Text → Image (Imagen generate)
 *   1b. Image → Image edit (Imagen edit, 1 ảnh input)
 *   1c. Multi-image → Image (Imagen edit, 1 ảnh base + N reference images)
 *   2. Text → Video (Veo)
 *   3. Image → Video (1 ảnh làm frame đầu)
 *   4. Start + End image → Video (2 ảnh: đầu + cuối)
 *   5. Start + Keyframes + End image → Video (3+ ảnh: đầu + giữa + cuối)
 *   6. Video → Video (extend 1 video)
 *   7. Start + End video → Video (2+ video: đầu + cuối)
 *
 * Auth: Bearer token (OAuth2 / Service Account).
 * Credential format (JSON string): { accessToken }
 *
 * Endpoint lấy trực tiếp từ nodeData.config.endpoint (ctx.url), ví dụ:
 *   Gemini:       https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:generateContent
 *   Imagen / Veo: https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:predict
 */

import axios from "axios";
import logger from "../../../helpers/logger";
import { ApiOutputTypeEnum } from "../../../libs/dal/product";
import { ExecuteProviderContext } from "../execute-provider";

/* ═══════════════════════════════════════════════════════════════════════════
 * Credential parsing
 * ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Trích accessToken từ credentialDecrypted.
 * Hỗ trợ JSON string `{ accessToken, ... }` hoặc plain access token string.
 */
function parseAccessToken(credentialDecrypted: string): string {
  const trimmed = credentialDecrypted.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return String(parsed.accessToken || "").trim();
    } catch {
      // fallthrough
    }
  }

  return trimmed;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Entry point
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function CallProviderGeminiVertexApi(ctx: ExecuteProviderContext): Promise<unknown> {
  const { credentialDecrypted } = ctx;
  if (!credentialDecrypted?.trim()) {
    throw new Error("Vertex AI credential is required (credentialDecrypted).");
  }

  const accessToken = parseAccessToken(credentialDecrypted);
  if (!accessToken) throw new Error("Vertex AI: accessToken is required.");
  if (!ctx.url?.trim()) throw new Error("Vertex AI: endpoint URL is required (nodeData.config.endpoint).");

  if (ctx.outputType === ApiOutputTypeEnum.IMAGE) {
    return callVertexImagenApi(accessToken, ctx);
  }
  if (ctx.outputType === ApiOutputTypeEnum.VIDEO) {
    return callVertexVeoApi(accessToken, ctx);
  }
  return callVertexGeminiApi(accessToken, ctx);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * TEXT / CHAT – Gemini generateContent API
 * Endpoint: .../{model}:generateContent
 * Body: { contents: [{ parts: [{ text }] }], generationConfig?: { ... } }
 * ═══════════════════════════════════════════════════════════════════════════ */

async function callVertexGeminiApi(
  accessToken: string,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const bodyObj = extractBodyObj(ctx.body);

  let requestBody: Record<string, unknown>;

  if (bodyObj.contents) {
    requestBody = bodyObj;
  } else {
    const prompt = extractPrompt(bodyObj, ctx.body);
    const parts: Array<Record<string, unknown>> = [{ text: prompt }];

    const { imageUrls } = collectMediaFromFieldValues(ctx.fieldValues);
    for (const url of imageUrls) {
      parts.push({ fileData: { fileUri: url, mimeType: guessMimeType(url) } });
    }

    requestBody = { contents: [{ parts }] };
  }

  if (bodyObj.generationConfig) {
    requestBody.generationConfig = bodyObj.generationConfig;
  }

  try {
    const data = await vertexPost(ctx.url, accessToken, requestBody);
    return { ...data, _vertexProvider: true };
  } catch (err: any) {
    logger.error(
      `[Vertex AI] callVertexGeminiApi failed url=${ctx.url} status=${err?.vertexStatus ?? err?.response?.status}`,
    );
    throw err;
  }
}

function guessMimeType(url: string): string {
  const ext = url.split(/[?#]/)[0].split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
    gif: "image/gif", webp: "image/webp", bmp: "image/bmp",
    mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
  };
  return map[ext || ""] || "application/octet-stream";
}

/* ═══════════════════════════════════════════════════════════════════════════
 * IMAGE – Imagen predict API
 * Response: { predictions: [{ bytesBase64Encoded, mimeType }] }
 *
 * Auto-detect media từ fieldValues:
 *   - Không có ảnh  → Text→Image       (imagen-3.0-generate-002)
 *   - 1 ảnh         → Image→Image edit (imagen-3.0-edit-002)
 *   - 2+ ảnh        → ảnh đầu = base, còn lại = referenceImages (imagen-3.0-edit-002)
 * ═══════════════════════════════════════════════════════════════════════════ */

async function callVertexImagenApi(
  accessToken: string,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const bodyObj = extractBodyObj(ctx.body);
  const prompt = extractPrompt(bodyObj, ctx.body);
  const { imageUrls } = collectMediaFromFieldValues(ctx.fieldValues);

  const instance = buildImagenInstance(prompt, imageUrls, bodyObj);

  const parameters: Record<string, unknown> = {
    sampleCount: (bodyObj.sampleCount as number) ?? (bodyObj.numberOfImages as number) ?? 1,
  };
  if (bodyObj.aspectRatio) parameters.aspectRatio = bodyObj.aspectRatio;
  if (bodyObj.personGeneration) parameters.personGeneration = bodyObj.personGeneration;

  const requestBody = { instances: [instance], parameters };

  try {
    const data = await vertexPost(ctx.url, accessToken, requestBody);
    return { ...data, _vertexProvider: true };
  } catch (err: any) {
    logger.error(
      `[Vertex AI] callVertexImagenApi failed url=${ctx.url} status=${err?.vertexStatus ?? err?.response?.status}`,
    );
    throw err;
  }
}

/**
 * Xây instance cho Imagen – auto-detect media từ fieldValues.
 *
 * 0 ảnh  → { prompt }
 * 1 ảnh  → { prompt, image: { uri } }
 * 2+ ảnh → { prompt, image: { uri: first }, referenceImages: [{ uri }, ...] }
 */
function buildImagenInstance(
  prompt: string,
  imageUrls: string[],
  bodyObj: Record<string, unknown>
): Record<string, unknown> {
  const instance: Record<string, unknown> = { prompt };

  const explicitImage = bodyObj.image as Record<string, unknown> | string | undefined;
  const explicitRefs = bodyObj.referenceImages as unknown[] | undefined;

  if (explicitImage || explicitRefs) {
    if (explicitImage) {
      instance.image = typeof explicitImage === "string" ? { uri: explicitImage } : explicitImage;
    }
    if (Array.isArray(explicitRefs) && explicitRefs.length > 0) {
      instance.referenceImages = explicitRefs.map((r) =>
        typeof r === "string" ? { uri: r } : r
      );
    }
    return instance;
  }

  if (imageUrls.length === 0) return instance;

  instance.image = { uri: imageUrls[0] };

  if (imageUrls.length >= 2) {
    instance.referenceImages = imageUrls.slice(1).map((uri) => ({ uri }));
  }

  return instance;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * VIDEO – Veo predict API
 *
 * Auto-detect media từ fieldValues (tên field tự do):
 *   - 1 video → extend | 2+ video → start + end
 *   - 1 ảnh → image→video | 2 ảnh → start + end | 3+ ảnh → start + keyframes + end
 *   - Không có media → text → video (prompt only)
 * ═══════════════════════════════════════════════════════════════════════════ */

async function callVertexVeoApi(
  accessToken: string,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const bodyObj = extractBodyObj(ctx.body);
  const prompt = extractPrompt(bodyObj, ctx.body);
  const fieldValues = ctx.fieldValues;

  const parameters: Record<string, unknown> = {};
  if (bodyObj.durationSeconds) parameters.durationSeconds = bodyObj.durationSeconds;
  if (bodyObj.aspectRatio) parameters.aspectRatio = bodyObj.aspectRatio;
  if (bodyObj.fps) parameters.fps = bodyObj.fps;
  if (bodyObj.seed != null) parameters.seed = bodyObj.seed;

  const durationSeconds = (bodyObj.durationSeconds as number) || 8;
  const instance = buildVeoInstance(prompt, fieldValues, durationSeconds);
  const requestBody = { instances: [instance], parameters };

  try {
    const data = await vertexPost(ctx.url, accessToken, requestBody);
    return { ...data, _vertexProvider: true };
  } catch (err: any) {
    logger.error(
      `[Vertex AI] callVertexVeoApi failed url=${ctx.url} status=${err?.vertexStatus ?? err?.response?.status}`,
    );
    throw err;
  }
}

/**
 * Xây instance cho Veo – auto-detect media từ fieldValues.
 * Quét tất cả URL trong fieldValues, phân loại image/video theo extension.
 *
 * Video:  1 → extend | 2+ → startVideo (đầu) + endVideo (cuối)
 * Image:  1 → image→video | 2 → startImage + endImage
 *         3+ → startImage + keyframes (chia đều theo giây) + endImage
 * Không có media → text → video (prompt only)
 */
function buildVeoInstance(
  prompt: string,
  fieldValues: Record<string, unknown>,
  durationSeconds: number
): Record<string, unknown> {
  const instance: Record<string, unknown> = { prompt };
  const { imageUrls, videoUrls } = collectMediaFromFieldValues(fieldValues);

  if (videoUrls.length >= 2) {
    instance.startVideo = { uri: videoUrls[0] };
    instance.endVideo = { uri: videoUrls[videoUrls.length - 1] };
    return instance;
  }
  if (videoUrls.length === 1) {
    instance.video = { uri: videoUrls[0] };
    return instance;
  }

  if (imageUrls.length >= 3) {
    instance.startImage = { uri: imageUrls[0] };
    instance.endImage = { uri: imageUrls[imageUrls.length - 1] };
    const middleImages = imageUrls.slice(1, -1);
    const step = durationSeconds / (imageUrls.length - 1);
    instance.keyframes = middleImages.map((url, i) => ({
      image: { uri: url },
      time: Math.round(step * (i + 1)),
    }));
    return instance;
  }
  if (imageUrls.length === 2) {
    instance.startImage = { uri: imageUrls[0] };
    instance.endImage = { uri: imageUrls[1] };
    return instance;
  }
  if (imageUrls.length === 1) {
    instance.image = { uri: imageUrls[0] };
    return instance;
  }

  return instance;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * HTTP helper – gọi Vertex AI endpoint (predict / generateContent)
 * ═══════════════════════════════════════════════════════════════════════════ */

async function vertexPost(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  logger.info(`[Vertex AI] POST ${endpoint}`);

  try {
    const response = await axios.post(endpoint, body, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      timeout: 300_000,
    });

    return response.data as Record<string, unknown>;
  } catch (err: any) {
    const status = err?.response?.status;
    const data = err?.response?.data;

    const message = (() => {
      if (data == null) return "";
      try {
        // Vertex AI errors often have shape: { error: { message: string, ... } }
        if (typeof data === "object") {
          const maybeError = (data as any).error;
          const maybeMessage = maybeError?.message;
          if (typeof maybeMessage === "string") return maybeMessage;
        }

        const asString = typeof data === "string" ? data : JSON.stringify(data);
        return asString.length > 2000 ? asString.slice(0, 2000) + "...(truncated)" : asString;
      } catch {
        return String(data);
      }
    })();

    logger.error(`[Vertex AI] POST failed status=${status} message=${message}`);

    // Safe rethrow so upstream doesn't print huge axios request bodies.
    const safeError = new Error(
      `Vertex AI POST failed (status=${status}). ${message ? `Details: ${message}` : ""}`.trim(),
    );
    (safeError as any).vertexStatus = status;
    (safeError as any).vertexResponseMessage = message;
    throw safeError;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Utility helpers
 * ═══════════════════════════════════════════════════════════════════════════ */

function extractBodyObj(body: unknown): Record<string, unknown> {
  if (typeof body === "string") {
    try {
      const parsed = JSON.parse(body);
      if (typeof parsed === "object" && parsed !== null) return parsed;
    } catch {
      // fallthrough
    }
  }
  if (typeof body === "object" && body !== null) return body as Record<string, unknown>;
  return {};
}

function extractPrompt(bodyObj: Record<string, unknown>, rawBody: unknown): string {
  if (typeof bodyObj.prompt === "string") return bodyObj.prompt.trim();
  if (typeof rawBody === "string" && rawBody.trim() && !rawBody.trim().startsWith("{")) {
    return rawBody.trim();
  }
  return "";
}

function isMediaUrl(value: unknown): value is string {
  if (typeof value !== "string" || !value.trim()) return false;
  return /^https?:\/\//i.test(value.trim());
}

const VIDEO_EXT_RE = /\.(mp4|webm|mov|avi|mkv|flv|wmv|m4v|3gp)(\?|#|$)/i;

function collectMediaFromFieldValues(
  fieldValues: Record<string, unknown>
): { imageUrls: string[]; videoUrls: string[] } {
  const imageUrls: string[] = [];
  const videoUrls: string[] = [];

  function classify(url: string): void {
    if (VIDEO_EXT_RE.test(url)) videoUrls.push(url);
    else imageUrls.push(url);
  }

  function walk(obj: unknown): void {
    if (obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) {
        if (isMediaUrl(item)) classify(item.trim());
        else if (typeof item === "object" && item !== null) walk(item);
      }
      return;
    }
    if (typeof obj === "object") {
      for (const value of Object.values(obj as Record<string, unknown>)) {
        if (isMediaUrl(value)) classify(value.trim());
        else if (Array.isArray(value) || (typeof value === "object" && value !== null)) walk(value);
      }
    }
  }

  walk(fieldValues);
  return { imageUrls, videoUrls };
}
