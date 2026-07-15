import logger from "../../../helpers/logger";
import { getFlow2Config } from "../../api-media/flow2/_shared";
import { retryAICall } from "./_ai-retry";
import { getAiSceneMoreSetting } from "./_ai-scene";
import {
  AffiliateVideoOpenAIJsonSchema,
  CHATGPT_GATEWAY_SYSTEM_MESSAGE,
  ChatGPTGatewayImage,
  ChatGPTGatewayVideo,
  DEFAULT_CHATGPT_GATEWAY_BASE_URL,
  DEFAULT_CHATGPT_MODEL,
} from "./_chatgpt.constants";

export { AffiliateVideoOpenAIJsonSchema };
export type { ChatGPTGatewayImage, ChatGPTGatewayVideo };

function normalizeGatewayBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

function isLegacyVietApiEndpoint(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "api.vietapi.tech" || host.includes("vietapi");
  } catch {
    return /vietapi/i.test(url);
  }
}

/** Resolve Flow2 host cho ChatGPT API (`viettheo.site` → `flow2.viettheo.site`). */
function resolveChatGPTFlow2BaseUrl(apiBaseUrl: string): string {
  try {
    const url = new URL(apiBaseUrl);
    if (url.hostname === "viettheo.site" || url.hostname === "www.viettheo.site") {
      url.hostname = "flow2.viettheo.site";
    }
    return normalizeGatewayBaseUrl(url.origin);
  } catch {
    return normalizeGatewayBaseUrl(apiBaseUrl);
  }
}

/**
 * Base URL Flow2 ChatGPT (`/api/v1/chatgpt/*`).
 * Ưu tiên Flow2 config (cùng token f2api), bỏ endpoint VietAPI cũ nếu còn trong setting.
 */
export async function getChatGPTGatewayBaseUrl(): Promise<string> {
  try {
    const { baseUrl } = await getFlow2Config();
    if (baseUrl) return resolveChatGPTFlow2BaseUrl(baseUrl);
  } catch {
    // fallback bên dưới
  }

  try {
    const endpoint = (await getAiSceneMoreSetting())?.chatgptEndpoint?.trim();
    if (endpoint && !isLegacyVietApiEndpoint(endpoint)) {
      return resolveChatGPTFlow2BaseUrl(endpoint);
    }
  } catch {
    // fallback bên dưới
  }

  const envUrl = process.env.CHATGPT_GATEWAY_BASE_URL?.trim();
  if (envUrl && !isLegacyVietApiEndpoint(envUrl)) {
    return resolveChatGPTFlow2BaseUrl(envUrl);
  }

  return normalizeGatewayBaseUrl(DEFAULT_CHATGPT_GATEWAY_BASE_URL);
}

/** Token Flow2 (`f2api_...`) dùng cho `/api/v1/chatgpt/*`. */
export async function getChatGPTGatewayToken(): Promise<string> {
  const { token } = await getFlow2Config();
  if (!token?.trim()) {
    const err: any = new Error("Thiếu cấu hình Flow2 API key cho ChatGPT");
    err.statusCode = 403;
    throw err;
  }
  return token.trim();
}

function buildChatPrompt(params: {
  text: string;
  jsonSchema?: Record<string, unknown>;
}): string {
  const parts = [CHATGPT_GATEWAY_SYSTEM_MESSAGE, params.text.trim()];
  if (params.jsonSchema) {
    parts.push(
      [
        "Output MUST match this JSON Schema exactly.",
        "Return ONLY the JSON instance — no keys outside the schema, no extra text:",
        JSON.stringify(params.jsonSchema),
      ].join("\n")
    );
  }
  parts.push(
    "FINAL REMINDER: reply with raw JSON only. No markdown. No explanation. No trailing text."
  );
  return parts.filter(Boolean).join("\n\n");
}

/** Cắt JSON thuần từ text AI; fail nếu không parse được. */
function extractPureJsonText(text: string): string {
  let s = text.trim();
  const fenceMatch = s.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch?.[1]) {
    s = fenceMatch[1].trim();
  }
  if (!(s.startsWith("{") || s.startsWith("["))) {
    const firstBrace = s.indexOf("{");
    const lastBrace = s.lastIndexOf("}");
    const firstBracket = s.indexOf("[");
    const lastBracket = s.lastIndexOf("]");
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      s = s.slice(firstBrace, lastBrace + 1);
    } else if (firstBracket !== -1 && lastBracket > firstBracket) {
      s = s.slice(firstBracket, lastBracket + 1);
    }
  }

  try {
    JSON.parse(s);
    return s;
  } catch {
    const err: any = new Error("AI trả kết quả không phải JSON thuần");
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }
}

function toPublicChatImages(
  images: ChatGPTGatewayImage[] | undefined
): Array<{ data: string; file_name: string; mime_type: string }> | undefined {
  if (!images?.length) return undefined;
  return images.map((image, index) => {
    const mimeType = image.mimeType || "image/jpeg";
    const ext = mimeType.includes("png")
      ? "png"
      : mimeType.includes("webp")
        ? "webp"
        : mimeType.includes("gif")
          ? "gif"
          : "jpg";
    const data = image.imageBytes.startsWith("data:")
      ? image.imageBytes
      : `data:${mimeType};base64,${image.imageBytes}`;
    return {
      data,
      file_name: image.fileName?.trim() || `photo-${index + 1}.${ext}`,
      mime_type: mimeType,
    };
  });
}

/** GET /api/v1/chatgpt/status — bắt buộc trước khi gửi chat có ảnh. */
async function ensureChatGPTReadyForImages(label: string): Promise<void> {
  const status = await checkChatGPTGatewayStatus();
  if (status.ok) return;

  const detail = JSON.stringify(status.raw).slice(0, 300);
  logger.warn(`[${label}] Flow2 ChatGPT status not ready: ${detail}`);
  const err: any = new Error(`Flow2 ChatGPT chưa sẵn sàng (status): ${detail}`);
  err.statusCode = 503;
  err.retryable = true;
  throw err;
}

function parseChatGPTV1Body(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    const err: any = new Error("AI không trả kết quả");
    err.statusCode = 502;
    throw err;
  }

  try {
    const data = JSON.parse(trimmed) as {
      ok?: boolean;
      text?: unknown;
      error?: unknown;
      requirements_error?: unknown;
      conversation_id?: string;
      message_id?: string;
    };

    if (data.ok === false || data.requirements_error) {
      const detail =
        (typeof data.requirements_error === "string" && data.requirements_error) ||
        (typeof data.error === "string" && data.error) ||
        trimmed.slice(0, 300);
      const err: any = new Error(`Flow2 ChatGPT error: ${detail}`);
      err.statusCode = 502;
      throw err;
    }

    if (typeof data.text === "string" && data.text.trim()) {
      return extractPureJsonText(data.text);
    }
  } catch (err: any) {
    if (err?.statusCode) throw err;
    // không phải JSON envelope — fallback bên dưới
  }

  return extractPureJsonText(trimmed);
}

/**
 * Gọi ChatGPT qua Flow2 public API:
 * POST /api/v1/chatgpt/chat  body: { prompt, model, images?, conversation_id?, parent_message_id? }
 */
export async function callChatGPTGateway(params: {
  text: string;
  images?: ChatGPTGatewayImage[];
  videos?: ChatGPTGatewayVideo[];
  label: string;
  jsonSchema?: Record<string, unknown>;
  jsonSchemaName?: string;
  temperature?: number;
  /** Không dùng trên Flow2 ChatGPT v1 — giữ để tương thích caller. */
  maxTokens?: number;
  /** Model Flow2 (ví dụ `"gpt-5-5"`). */
  model?: string;
  /** Multi-turn: conversation_id từ response trước. */
  conversationId?: string;
  /** Multi-turn: message_id từ response trước → parent_message_id. */
  parentMessageId?: string;
}): Promise<string> {
  if (params.videos?.length) {
    logger.warn(
      `[${params.label}] Flow2 ChatGPT v1 chưa hỗ trợ video — bỏ qua ${params.videos.length} video`
    );
  }

  const prompt = buildChatPrompt({
    text: params.text,
    jsonSchema: params.jsonSchema,
  });
  const images = toPublicChatImages(params.images);
  const [baseUrl, apiKey] = await Promise.all([
    getChatGPTGatewayBaseUrl(),
    getChatGPTGatewayToken(),
  ]);
  const model = params.model?.trim() || DEFAULT_CHATGPT_MODEL;
  const chatUrl = `${baseUrl}/api/v1/chatgpt/chat`;

  return retryAICall(async () => {
    if (images?.length) {
      await ensureChatGPTReadyForImages(params.label);
    }

    const resp = await fetch(chatUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt,
        model,
        ...(params.conversationId ? { conversation_id: params.conversationId } : {}),
        ...(params.parentMessageId ? { parent_message_id: params.parentMessageId } : {}),
        ...(images ? { images } : {}),
      }),
    });

    const rawBody = await resp.text();
    if (!resp.ok) {
      const err: any = new Error(
        `Flow2 ChatGPT API error (${resp.status}) ${chatUrl}: ${rawBody}`
      );
      err.statusCode = resp.status;
      if (resp.status === 429 || resp.status === 503 || resp.status === 502) {
        err.retryable = true;
      }
      throw err;
    }

    return parseChatGPTV1Body(rawBody);
  }, params.label);
}

/** Kiểm tra ChatGPT extension/session sẵn sàng: GET /api/v1/chatgpt/status */
export async function checkChatGPTGatewayStatus(): Promise<{
  ok: boolean;
  raw: Record<string, unknown>;
}> {
  const [baseUrl, apiKey] = await Promise.all([
    getChatGPTGatewayBaseUrl(),
    getChatGPTGatewayToken(),
  ]);

  const resp = await fetch(`${baseUrl}/api/v1/chatgpt/status`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const rawBody = await resp.text();
  if (!resp.ok) {
    const err: any = new Error(`Flow2 ChatGPT status error (${resp.status}): ${rawBody}`);
    err.statusCode = resp.status;
    throw err;
  }

  try {
    const raw = JSON.parse(rawBody) as Record<string, unknown>;
    return { ok: raw.ok === true, raw };
  } catch {
    const err: any = new Error("Flow2 ChatGPT status trả JSON không hợp lệ");
    err.statusCode = 502;
    throw err;
  }
}
