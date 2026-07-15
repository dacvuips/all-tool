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

/** Timeout poll ChatGPT async (ảnh + JSON dài có thể > 2 phút — vượt Cloudflare sync 524). */
const CHATGPT_ASYNC_TIMEOUT_MS = 15 * 60 * 1000;
const CHATGPT_ASYNC_POLL_INTERVAL_MS = 2_500;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableHttpStatus(status: number): boolean {
  return status === 429 || status === 502 || status === 503 || status === 504 || status === 524;
}

function throwHttpError(label: string, status: number, url: string, rawBody: string): never {
  const err: any = new Error(`Flow2 ChatGPT API error (${status}) ${url}: ${rawBody}`);
  err.statusCode = status;
  if (isRetryableHttpStatus(status)) {
    err.retryable = true;
  }
  logger.warn(`[${label}] ${err.message.slice(0, 400)}`);
  throw err;
}

type ChatGPTJobStatus = "queued" | "running" | "done" | "failed" | string;

function normalizeJobStatus(value: unknown): ChatGPTJobStatus {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function pickChatGPTResultText(data: Record<string, unknown>): string | undefined {
  const candidates: unknown[] = [
    data.text,
    (data.result as Record<string, unknown> | undefined)?.text,
    (data.data as Record<string, unknown> | undefined)?.text,
    (data.response as Record<string, unknown> | undefined)?.text,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return undefined;
}

function pickJobError(data: Record<string, unknown>): string {
  const candidates: unknown[] = [
    data.error,
    data.requirements_error,
    (data.result as Record<string, unknown> | undefined)?.error,
    data.detail,
    data.message,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
  }
  return JSON.stringify(data).slice(0, 300);
}

/** Parse envelope sync/job-done → JSON thuần. */
function parseChatGPTV1Result(data: Record<string, unknown>): string {
  if (data.ok === false || data.requirements_error) {
    const err: any = new Error(`Flow2 ChatGPT error: ${pickJobError(data)}`);
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }

  const text = pickChatGPTResultText(data);
  if (text) return extractPureJsonText(text);

  const err: any = new Error("AI không trả kết quả text");
  err.statusCode = 502;
  err.retryable = true;
  throw err;
}

function parseEnqueueResponse(raw: string): { jobId?: string; immediateText?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    const err: any = new Error("Flow2 ChatGPT async không trả body");
    err.statusCode = 502;
    throw err;
  }

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    const err: any = new Error("Flow2 ChatGPT async trả JSON không hợp lệ");
    err.statusCode = 502;
    throw err;
  }

  const jobId =
    (typeof data.id === "string" && data.id.trim()) ||
    (typeof data.job_id === "string" && data.job_id.trim()) ||
    (typeof data.request_id === "string" && data.request_id.trim()) ||
    undefined;

  if (jobId) return { jobId };

  // Fallback: server trả sync dù gọi async
  if (typeof data.text === "string" && data.text.trim()) {
    return { immediateText: parseChatGPTV1Result(data) };
  }

  const err: any = new Error(
    `Flow2 ChatGPT async thiếu job id: ${trimmed.slice(0, 300)}`
  );
  err.statusCode = 502;
  throw err;
}

async function pollChatGPTJob(params: {
  baseUrl: string;
  apiKey: string;
  jobId: string;
  label: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<string> {
  const timeoutMs = params.timeoutMs ?? CHATGPT_ASYNC_TIMEOUT_MS;
  const pollIntervalMs = params.pollIntervalMs ?? CHATGPT_ASYNC_POLL_INTERVAL_MS;
  const pollUrl = `${params.baseUrl}/api/v1/chatgpt/chat/${encodeURIComponent(params.jobId)}`;
  const startedAt = Date.now();
  let lastStatus = "";

  while (Date.now() - startedAt < timeoutMs) {
    const resp = await fetch(pollUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
    });
    const rawBody = await resp.text();
    if (!resp.ok) {
      throwHttpError(params.label, resp.status, pollUrl, rawBody);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      const err: any = new Error(`Flow2 ChatGPT poll JSON không hợp lệ: ${rawBody.slice(0, 200)}`);
      err.statusCode = 502;
      throw err;
    }

    const status = normalizeJobStatus(data.status);
    if (status && status !== lastStatus) {
      lastStatus = status;
      logger.info(`[${params.label}] ChatGPT job ${params.jobId} status=${status}`);
    }

    if (status === "failed" || status === "error") {
      const err: any = new Error(
        `Flow2 ChatGPT job failed (${params.jobId}): ${pickJobError(data)}`
      );
      err.statusCode = 502;
      err.retryable = true;
      throw err;
    }

    const isPending =
      status === "queued" ||
      status === "running" ||
      status === "pending" ||
      status === "processing";

    // Chỉ coi xong khi status = done (KHÔNG dùng data.ok — ok=true thường xuất hiện cả lúc running)
    if (status === "done" || status === "succeeded" || status === "success") {
      return parseChatGPTV1Result(data);
    }

    // Fallback: có text thật và không còn pending
    const maybeText = pickChatGPTResultText(data);
    if (maybeText && !isPending) {
      return extractPureJsonText(maybeText);
    }

    await sleep(pollIntervalMs);
  }

  const err: any = new Error(
    `Flow2 ChatGPT job timeout (${timeoutMs}ms) jobId=${params.jobId} lastStatus=${lastStatus || "unknown"}`
  );
  err.statusCode = 504;
  err.retryable = true;
  throw err;
}

/**
 * Gọi ChatGPT qua Flow2 public API (async + poll — tránh Cloudflare 524):
 * POST /api/v1/chatgpt/chat?async=true → { id, status, poll_url }
 * GET  /api/v1/chatgpt/chat/{id} đến done|failed
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
  const enqueueUrl = `${baseUrl}/api/v1/chatgpt/chat?async=true`;

  return retryAICall(async () => {
    if (images?.length) {
      await ensureChatGPTReadyForImages(params.label);
    }

    const resp = await fetch(enqueueUrl, {
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
      throwHttpError(params.label, resp.status, enqueueUrl, rawBody);
    }

    const enqueued = parseEnqueueResponse(rawBody);
    if (enqueued.immediateText) {
      logger.info(`[${params.label}] Flow2 ChatGPT trả kết quả sync (không cần poll)`);
      return enqueued.immediateText;
    }

    logger.info(`[${params.label}] Flow2 ChatGPT async queued jobId=${enqueued.jobId}`);
    return pollChatGPTJob({
      baseUrl,
      apiKey,
      jobId: enqueued.jobId!,
      label: params.label,
    });
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
