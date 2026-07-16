import logger from "../../../helpers/logger";
import { fetchImageAsBase64 } from "../../helpers/handleUploadGoogleLabImages";
import { getFlow2Config } from "../../api-media/flow2/_shared";
import { retryAICall } from "./_ai-retry";
import { getAiSceneMoreSetting } from "./_ai-scene";
import {
  AffiliateVideoOpenAIJsonSchema,
  CHATGPT_GATEWAY_SYSTEM_MESSAGE,
  CHATGPT_PICTURE_MODE,
  CHATGPT_PICTURE_SYSTEM_HINTS,
  ChatGPTGatewayImage,
  ChatGPTGatewayVideo,
  DEFAULT_CHATGPT_GATEWAY_BASE_URL,
  DEFAULT_CHATGPT_MODEL,
} from "./_chatgpt.constants";

export { AffiliateVideoOpenAIJsonSchema };
export type { ChatGPTGatewayImage, ChatGPTGatewayVideo };

export type ChatGPTPictureResult = {
  text: string;
  images: Array<{ imageBytes: string; mimeType: string }>;
  conversationId?: string;
  messageId?: string;
};

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

/** GET /api/v1/chatgpt/status — kiểm tra session/extension sẵn sàng. */
async function ensureChatGPTReady(label: string): Promise<void> {
  const status = await checkChatGPTGatewayStatus();
  if (status.ok) return;

  const detail = JSON.stringify(status.raw).slice(0, 300);
  logger.warn(`[${label}] Flow2 ChatGPT status not ready: ${detail}`);
  const err: any = new Error(`Flow2 ChatGPT chưa sẵn sàng. Vui lòng thử lại sau.`);
  err.statusCode = 503;
  err.retryable = true;
  throw err;
}

/** GET /api/v1/chatgpt/status — bắt buộc trước khi gửi chat có ảnh. */
async function ensureChatGPTReadyForImages(label: string): Promise<void> {
  await ensureChatGPTReady(label);
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

/**
 * Flow2 picture_v2 đôi khi nhét payload tool tạo ảnh vào `text`
 * (prompt, referenced_image_ids, size...) — không phải nội dung chat.
 */
function isPictureGenDebrisText(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/referenced_image_ids/i.test(t)) return true;
  if (/"prompt"\s*:/.test(t) && (/"n"\s*:\s*\d/.test(t) || /Negative prompt/i.test(t))) {
    return true;
  }
  if (/\d+x\d+"\s*,\s*"n"\s*:/.test(t)) return true;
  if (
    (t.includes('"prompt"') || t.includes('"size"')) &&
    /file_[a-z0-9]+/i.test(t) &&
    t.length > 200
  ) {
    return true;
  }
  if (/^[{["].{0,80}"(prompt|size|n|referenced_image)/i.test(t)) return true;
  return false;
}

/** Làm sạch text trả về cho UI storyboard — bỏ metadata image-gen thừa. */
function sanitizePictureSuggestText(raw: string): string {
  let text = raw.trim();
  if (!text) return "";

  // Bỏ markdown image (giữ URL để collector lấy riêng)
  text = text.replace(/!\[[^\]]*]\([^)]+\)/g, "").trim();
  // Bỏ code fence JSON
  text = text.replace(/```(?:json)?\s*[\s\S]*?```/gi, "").trim();

  if (isPictureGenDebrisText(text)) {
    const jsonStart = text.search(/[{[]?\s*"(?:prompt|size|n|referenced_image)/i);
    if (jsonStart > 20) {
      const prefix = text.slice(0, jsonStart).trim();
      if (prefix && !isPictureGenDebrisText(prefix)) return prefix;
    }
    return "";
  }
  return text;
}

function looksLikeImagePayload(value: string, mime?: string): boolean {
  if (mime?.startsWith("image/")) return true;
  if (value.startsWith("data:image/")) return true;
  if (/^https?:\/\//i.test(value)) return true;
  const cleaned = normalizeBase64Data(value);
  // Tránh nhầm JSON tool-args thành base64 ảnh
  if (/["{}]|prompt|referenced_image/i.test(cleaned.slice(0, 400))) return false;
  if (cleaned.length < 256) return false;
  return /^[A-Za-z0-9+/=\s]+$/.test(cleaned.slice(0, 800));
}

async function fetchImageWithAuth(
  url: string,
  apiKey: string
): Promise<{ imageBytes: string; mimeType: string }> {
  const resp = await fetch(url, {
    headers: {
      Accept: "image/*,application/octet-stream,*/*",
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!resp.ok) {
    const err: any = new Error(`Không tải được ảnh (${resp.status}): ${url}`);
    err.statusCode = resp.status;
    throw err;
  }
  const contentType = resp.headers.get("content-type") || "";
  if (contentType.includes("application/json") || contentType.includes("text/html")) {
    const err: any = new Error(`URL không trả về ảnh: ${url}`);
    err.statusCode = 502;
    throw err;
  }
  const buffer = Buffer.from(await resp.arrayBuffer());
  if (buffer.length < 64) {
    const err: any = new Error(`Ảnh rỗng từ URL: ${url}`);
    err.statusCode = 502;
    throw err;
  }
  return {
    imageBytes: buffer.toString("base64"),
    mimeType: guessMimeFromUrlOrName(contentType || url),
  };
}

/** Tải ảnh ChatGPT — ưu tiên Flow2 /media/{fileId} vì estuary URL thường 403. */
async function fetchChatGPTImageAsBase64(
  url: string,
  opts?: { baseUrl?: string; apiKey?: string }
): Promise<{ imageBytes: string; mimeType: string }> {
  const fileIdMatch =
    url.match(/[?&]id=(file_[a-zA-Z0-9]+)/i) || url.match(/\b(file_[a-f0-9]{10,})\b/i);

  if (opts?.baseUrl && opts?.apiKey && fileIdMatch?.[1]) {
    const mediaUrl = `${opts.baseUrl.replace(/\/$/, "")}/media/${encodeURIComponent(fileIdMatch[1])}`;
    try {
      return await fetchImageWithAuth(mediaUrl, opts.apiKey);
    } catch (err: any) {
      logger.warn(`[chatgpt-picture] Flow2 /media thất bại: ${err?.message}`);
    }
  }

  if (opts?.apiKey && /chatgpt\.com/i.test(url)) {
    try {
      return await fetchImageWithAuth(url, opts.apiKey);
    } catch (err: any) {
      logger.warn(`[chatgpt-picture] Auth fetch chatgpt.com thất bại: ${err?.message}`);
    }
  }

  return fetchImageAsBase64(url);
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

function normalizeBase64Data(value: string): string {
  const trimmed = value.trim();
  const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
  return match ? match[2] : trimmed;
}

function guessMimeFromUrlOrName(value?: string): string {
  const s = (value || "").toLowerCase();
  if (s.includes(".png") || s.includes("image/png")) return "image/png";
  if (s.includes(".webp") || s.includes("image/webp")) return "image/webp";
  if (s.includes(".gif") || s.includes("image/gif")) return "image/gif";
  return "image/jpeg";
}

function pickConversationMeta(data: Record<string, unknown>): {
  conversationId?: string;
  messageId?: string;
} {
  const findString = (obj: unknown, key: string, depth = 0): string | undefined => {
    if (obj == null || depth > 8) return undefined;
    if (typeof obj === "object" && !Array.isArray(obj)) {
      const rec = obj as Record<string, unknown>;
      const direct = rec[key];
      if (typeof direct === "string" && direct.trim()) return direct.trim();
      for (const v of Object.values(rec)) {
        const found = findString(v, key, depth + 1);
        if (found) return found;
      }
    }
    if (Array.isArray(obj)) {
      for (const item of obj) {
        const found = findString(item, key, depth + 1);
        if (found) return found;
      }
    }
    return undefined;
  };

  return {
    conversationId: findString(data, "conversation_id"),
    messageId: findString(data, "message_id"),
  };
}

/** Thu thập ảnh từ envelope Flow2 ChatGPT picture_v2. */
async function collectChatGPTResultImages(
  data: Record<string, unknown>,
  opts?: { baseUrl?: string; apiKey?: string }
): Promise<Array<{ imageBytes: string; mimeType: string }>> {
  const out: Array<{ imageBytes: string; mimeType: string }> = [];
  const seen = new Set<string>();

  const pushBytes = (raw: string, mimeType?: string) => {
    if (!looksLikeImagePayload(raw, mimeType)) return;
    const imageBytes = normalizeBase64Data(raw);
    if (!imageBytes || imageBytes.length < 32) return;
    const key = `${mimeType || ""}:${imageBytes.slice(0, 64)}:${imageBytes.length}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push({ imageBytes, mimeType: mimeType || "image/png" });
  };

  const pushUrl = async (url: string, mimeType?: string) => {
    const trimmed = url.trim().replace(/[),.;]+$/, "");
    if (!trimmed) return;
    if (trimmed.startsWith("data:")) {
      const match = trimmed.match(/^data:([^;]+);base64,([\s\S]+)$/);
      if (match) pushBytes(match[2], match[1] || mimeType);
      return;
    }
    if (!/^https?:\/\//i.test(trimmed)) return;
    try {
      const fetched = await fetchChatGPTImageAsBase64(trimmed, opts);
      pushBytes(fetched.imageBytes, fetched.mimeType || mimeType || guessMimeFromUrlOrName(trimmed));
    } catch (err: any) {
      logger.warn(`[chatgpt-picture] Không tải được ảnh URL: ${err?.message}`);
    }
  };

  const visit = async (node: unknown, depth = 0): Promise<void> => {
    if (node == null || depth > 10) return;

    if (typeof node === "string") {
      const s = node.trim();
      if (s.startsWith("data:image/")) {
        await pushUrl(s);
        return;
      }
      if (/^https?:\/\//i.test(s)) {
        if (
          /\.(png|jpe?g|webp|gif)(\?|$)/i.test(s) ||
          /chatgpt\.com\/backend-api\/estuary\//i.test(s) ||
          /\/media\//i.test(s)
        ) {
          await pushUrl(s);
        }
        return;
      }
      // Quét URL ảnh nhúng trong text dài (markdown / JSON debris)
      if (s.length > 40) {
        const urls = s.match(/https?:\/\/[^\s"'<>\\]+/g) || [];
        for (const u of urls) {
          if (
            /\.(png|jpe?g|webp|gif)(\?|$)/i.test(u) ||
            /chatgpt\.com\/backend-api\/estuary\//i.test(u) ||
            /\/media\//i.test(u)
          ) {
            await pushUrl(u);
          }
        }
      }
      return;
    }

    if (Array.isArray(node)) {
      for (const item of node) await visit(item, depth + 1);
      return;
    }

    if (typeof node !== "object") return;
    const obj = node as Record<string, unknown>;

    const bytesCandidate =
      (typeof obj.data === "string" && obj.data) ||
      (typeof obj.imageBytes === "string" && obj.imageBytes) ||
      (typeof obj.b64_json === "string" && obj.b64_json) ||
      (typeof obj.base64 === "string" && obj.base64) ||
      undefined;
    const mimeCandidate =
      (typeof obj.mime_type === "string" && obj.mime_type) ||
      (typeof obj.mimeType === "string" && obj.mimeType) ||
      undefined;
    if (bytesCandidate && looksLikeImagePayload(bytesCandidate, mimeCandidate || undefined)) {
      if (bytesCandidate.startsWith("http")) await pushUrl(bytesCandidate, mimeCandidate || undefined);
      else pushBytes(bytesCandidate, mimeCandidate || undefined);
    }

    const urlCandidate =
      (typeof obj.url === "string" && obj.url) ||
      (typeof obj.image_url === "string" && obj.image_url) ||
      (typeof obj.imageUrl === "string" && obj.imageUrl) ||
      (typeof obj.fifeUrl === "string" && obj.fifeUrl) ||
      (typeof obj.download_url === "string" && obj.download_url) ||
      undefined;
    if (urlCandidate) await pushUrl(urlCandidate, mimeCandidate || undefined);

    for (const key of [
      "parts",
      "images",
      "files",
      "content",
      "message",
      "result",
      "data",
      "attachments",
      "assets",
      "outputs",
      "media",
      "generated_images",
      "image",
    ]) {
      if (obj[key]) await visit(obj[key], depth + 1);
    }
  };

  await visit(data);
  return out;
}

async function parseChatGPTPictureResult(
  data: Record<string, unknown>,
  opts?: { baseUrl?: string; apiKey?: string }
): Promise<ChatGPTPictureResult> {
  if (data.ok === false || data.requirements_error) {
    const err: any = new Error(`Flow2 ChatGPT error: ${pickJobError(data)}`);
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }

  const rawText = pickChatGPTResultText(data) || "";
  const text = sanitizePictureSuggestText(rawText);
  const images = await collectChatGPTResultImages(data, opts);
  const meta = pickConversationMeta(data);

  if (!text && images.length === 0) {
    const hadDebris = Boolean(rawText.trim()) && isPictureGenDebrisText(rawText);
    const err: any = new Error(
      hadDebris
        ? "AI đã tạo ảnh nhưng không tải được file ảnh (URL ChatGPT bị chặn). Vui lòng thử lại."
        : "AI không trả text hoặc ảnh"
    );
    err.statusCode = 502;
    err.retryable = true;
    throw err;
  }

  return {
    text,
    images,
    conversationId: meta.conversationId,
    messageId: meta.messageId,
  };
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

async function pollChatGPTPictureJob(params: {
  baseUrl: string;
  apiKey: string;
  jobId: string;
  label: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<ChatGPTPictureResult> {
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

    if (status === "done" || status === "succeeded" || status === "success") {
      return parseChatGPTPictureResult(data, {
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
      });
    }

    if (!isPending) {
      const maybeText = sanitizePictureSuggestText(pickChatGPTResultText(data) || "");
      const maybeImages = await collectChatGPTResultImages(data, {
        baseUrl: params.baseUrl,
        apiKey: params.apiKey,
      });
      if (maybeText || maybeImages.length > 0) {
        return parseChatGPTPictureResult(data, {
          baseUrl: params.baseUrl,
          apiKey: params.apiKey,
        });
      }
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
 * Gọi Flow2 ChatGPT Conversation image (async + poll).
 *
 * Luôn gửi: mode=picture_v2, system_hints=["picture_v2"], picture=true
 * Follow-up thêm: conversation_id + parent_message_id (+ images?)
 */
export async function callChatGPTPictureSuggest(params: {
  prompt: string;
  label: string;
  model?: string;
  conversationId?: string;
  parentMessageId?: string;
  images?: ChatGPTGatewayImage[];
}): Promise<ChatGPTPictureResult> {
  const [baseUrl, apiKey] = await Promise.all([
    getChatGPTGatewayBaseUrl(),
    getChatGPTGatewayToken(),
  ]);

  const isFollowUp = Boolean(params.conversationId?.trim() && params.parentMessageId?.trim());
  const model = params.model?.trim() || DEFAULT_CHATGPT_MODEL;
  const publicImages = toPublicChatImages(params.images);
  const enqueueUrl = `${baseUrl}/api/v1/chatgpt/chat?async=true`;

  // Conversation image — giữ mode trên cả lần 1 và follow-up
  const requestBody: Record<string, unknown> = {
    prompt: params.prompt.trim(),
    model,
    mode: CHATGPT_PICTURE_MODE,
    system_hints: [...CHATGPT_PICTURE_SYSTEM_HINTS],
    picture: true,
  };

  if (isFollowUp) {
    requestBody.conversation_id = params.conversationId!.trim();
    requestBody.parent_message_id = params.parentMessageId!.trim();
  }

  if (publicImages?.length) {
    requestBody.images = publicImages;
  }

  return retryAICall(async () => {
    if (publicImages?.length) {
      await ensureChatGPTReadyForImages(params.label);
    } else {
      await ensureChatGPTReady(params.label);
    }

    logger.info(
      `[${params.label}] Flow2 ChatGPT Conversation image ${isFollowUp ? "follow-up" : "new"} model=${model} refImages=${publicImages?.length || 0}`
    );

    const resp = await fetch(enqueueUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const rawBody = await resp.text();
    if (!resp.ok) {
      throwHttpError(params.label, resp.status, enqueueUrl, rawBody);
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawBody) as Record<string, unknown>;
    } catch {
      const err: any = new Error("Flow2 ChatGPT async trả JSON không hợp lệ");
      err.statusCode = 502;
      throw err;
    }

    const jobId =
      (typeof data.id === "string" && data.id.trim()) ||
      (typeof data.job_id === "string" && data.job_id.trim()) ||
      undefined;

    if (!jobId) {
      logger.info(`[${params.label}] Flow2 ChatGPT trả kết quả sync`);
      return parseChatGPTPictureResult(data, { baseUrl, apiKey });
    }

    logger.info(`[${params.label}] Flow2 ChatGPT async queued jobId=${jobId}`);
    const result = await pollChatGPTPictureJob({
      baseUrl,
      apiKey,
      jobId,
      label: params.label,
    });
    if (result.conversationId || result.messageId) {
      logger.info(
        `[${params.label}] conversation_id=${result.conversationId || "-"} message_id=${result.messageId || "-"}`
      );
    }
    return result;
  }, params.label);
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
