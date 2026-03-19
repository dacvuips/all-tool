/**
 * Google Vertex AI REST API – gọi trực tiếp endpoint Vertex AI bằng fetch.
 * Hỗ trợ Imagen (tạo ảnh) và Veo (tạo video):
 *   1. Text → Image (Imagen)
 *   2. Text → Video (Veo)
 *   3. Image → Video (1 ảnh làm frame đầu)
 *   4. Start + End image → Video (2 ảnh: đầu + cuối)
 *   5. Start + Keyframes + End image → Video (3+ ảnh: đầu + giữa + cuối)
 *   6. Video → Video (extend 1 video)
 *   7. Start + End video → Video (2+ video: đầu + cuối)
 *
 * Auth: Bearer token (OAuth2 / Service Account).
 * Credential format (JSON string): { accessToken, projectId, region }
 *
 * Endpoint:
 *   POST https://{region}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{region}/publishers/google/models/{model}:predict
 */

import axios from "axios";
import logger from "../../../helpers/logger";
import { ApiOutputTypeEnum } from "../../../libs/dal/product";
import { ExecuteProviderContext } from "../execute-provider";

/* ═══════════════════════════════════════════════════════════════════════════
 * Credential parsing
 * ═══════════════════════════════════════════════════════════════════════════ */

export interface VertexCredential {
  accessToken: string;
  projectId: string;
  region: string;
}

/**
 * Parse credential từ ctx.credentialDecrypted.
 * Hỗ trợ JSON string `{ accessToken, projectId, region }` hoặc plain access token
 * (khi projectId/region nằm trong body hoặc nodeData config).
 */
function parseVertexCredential(
  credentialDecrypted: string,
  body: unknown,
  nodeData: Record<string, unknown> | undefined
): VertexCredential {
  const trimmed = credentialDecrypted.trim();

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return {
        accessToken: String(parsed.accessToken || "").trim(),
        projectId: String(parsed.projectId || "").trim(),
        region: String(parsed.region || "us-central1").trim(),
      };
    } catch {
      // fallthrough
    }
  }

  const bodyObj = typeof body === "object" && body !== null ? (body as Record<string, unknown>) : {};
  const config = (nodeData as any)?.config as Record<string, unknown> | undefined;

  return {
    accessToken: trimmed,
    projectId: String(bodyObj.projectId || config?.vertexProjectId || "").trim(),
    region: String(bodyObj.region || config?.vertexRegion || "us-central1").trim(),
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Endpoint builder
 * ═══════════════════════════════════════════════════════════════════════════ */

function buildVertexEndpoint(cred: VertexCredential, model: string): string {
  return `https://${cred.region}-aiplatform.googleapis.com/v1/projects/${cred.projectId}/locations/${cred.region}/publishers/google/models/${model}:predict`;
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Entry point
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function CallProviderGeminiVertexApi(ctx: ExecuteProviderContext): Promise<unknown> {
  const { credentialDecrypted, body, nodeData } = ctx;
  if (!credentialDecrypted?.trim()) {
    throw new Error("Vertex AI credential is required (credentialDecrypted).");
  }

  const cred = parseVertexCredential(credentialDecrypted, body, nodeData as any);
  if (!cred.accessToken) throw new Error("Vertex AI: accessToken is required.");
  if (!cred.projectId) throw new Error("Vertex AI: projectId is required.");

  if (ctx.outputType === ApiOutputTypeEnum.IMAGE) {
    return callVertexImagenApi(cred, ctx);
  }
  if (ctx.outputType === ApiOutputTypeEnum.VIDEO) {
    return callVertexVeoApi(cred, ctx);
  }
  return callVertexImagenApi(cred, ctx);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * IMAGE – Imagen predict API
 * Response: { predictions: [{ bytesBase64Encoded, mimeType }] }
 * ═══════════════════════════════════════════════════════════════════════════ */

async function callVertexImagenApi(
  cred: VertexCredential,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const bodyObj = extractBodyObj(ctx.body);
  const model = getModel(ctx, "imagen-3.0-generate-002");
  const prompt = extractPrompt(bodyObj, ctx.body);

  const endpoint = buildVertexEndpoint(cred, model);

  const requestBody = {
    instances: [{ prompt }],
    parameters: {
      sampleCount: (bodyObj.sampleCount as number) ?? (bodyObj.numberOfImages as number) ?? 1,
      ...(bodyObj.aspectRatio ? { aspectRatio: bodyObj.aspectRatio } : {}),
      ...(bodyObj.personGeneration ? { personGeneration: bodyObj.personGeneration } : {}),
    },
  };

  const data = await vertexPredict(endpoint, cred.accessToken, requestBody);
  return { ...data, _vertexProvider: true };
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
  cred: VertexCredential,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const bodyObj = extractBodyObj(ctx.body);
  const model = getModel(ctx, "veo-3");
  const prompt = extractPrompt(bodyObj, ctx.body);
  const fieldValues = ctx.fieldValues;

  const endpoint = buildVertexEndpoint(cred, model);

  const parameters: Record<string, unknown> = {};
  if (bodyObj.durationSeconds) parameters.durationSeconds = bodyObj.durationSeconds;
  if (bodyObj.aspectRatio) parameters.aspectRatio = bodyObj.aspectRatio;
  if (bodyObj.fps) parameters.fps = bodyObj.fps;
  if (bodyObj.seed != null) parameters.seed = bodyObj.seed;

  const durationSeconds = (bodyObj.durationSeconds as number) || 8;
  const instance = buildVeoInstance(prompt, fieldValues, durationSeconds);
  const requestBody = { instances: [instance], parameters };

  const data = await vertexPredict(endpoint, cred.accessToken, requestBody);
  return { ...data, _vertexProvider: true };
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
 * HTTP helper – gọi Vertex AI predict endpoint
 * ═══════════════════════════════════════════════════════════════════════════ */

async function vertexPredict(
  endpoint: string,
  accessToken: string,
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  logger.info(`[Vertex AI] POST ${endpoint}`);

  const response = await axios.post(endpoint, body, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    timeout: 300_000,
  });

  return response.data as Record<string, unknown>;
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

function getModel(ctx: ExecuteProviderContext, defaultModel: string): string {
  const configModel = ctx.nodeData?.config?.model;
  if (typeof configModel === "string" && configModel.trim()) return configModel.trim();
  return defaultModel;
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
