import { stripDataUrlFromBase64 } from "../../helpers/handleUploadGoogleLabImages";
import { normalizeImageToDataUrl, type Flow2ImageInput } from "./image-generation";

export type { Flow2ImageInput };

export type Flow2AudioInput = string | { audioBytes: string; mimeType?: string };
import {
  cancelFlow2Request,
  createFlow2Request,
  getFlow2RequestStatus,
  isFlow2FailedStatus,
  isFlow2SuccessStatus,
  pickError,
  pickFlow2RequestId,
  pickStatus,
  runFlow2WithRetry,
  safeProgress,
  waitForFlow2Result,
  type Flow2StatusResponse,
} from "./_shared";

export const DEFAULT_FLOW2_TEXT_MODEL = "gemini-3-flash-preview";
export const DEFAULT_FLOW2_THINKING_LEVEL = "LOW";
export const FLOW2_TEXT_THINKING_LEVELS = ["LOW", "MEDIUM", "HIGH"] as const;
export const MAX_FLOW2_TEXT_IMAGES = 10;
export const MAX_FLOW2_TEXT_AUDIOS = 10;

export type Flow2ThinkingLevel = (typeof FLOW2_TEXT_THINKING_LEVELS)[number];

export type Flow2TextUsage = {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  thoughtsTokenCount?: number;
  totalTokenCount?: number;
};

export type Flow2TextResult = {
  text: string;
  json: Record<string, unknown> | unknown[] | null;
  usage: Flow2TextUsage | null;
  model?: string;
  thinkingLevel?: string;
  finishReason?: string;
  profileId?: string;
};

export type Flow2JsonSchema = Record<string, unknown> & {
  type?: string;
  properties?: Record<string, unknown>;
  items?: Record<string, unknown>;
  required?: string[];
};

export type Flow2CreateTextRequestParams = {
  prompt: string;
  systemInstruction?: string;
  model?: string;
  thinkingLevel?: string;
  imageInputs?: Flow2ImageInput[];
  audioInputs?: Flow2AudioInput[];
  /** Bật chế độ JSON output (json: true + response_mime_type: "application/json") */
  jsonMode?: boolean;
  /** Schema JSON để Flow2 enforce output structure */
  jsonSchema?: Flow2JsonSchema;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  onRequestCreated?: (requestId: string) => void | Promise<void>;
  customerId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function flow2Opts(customerId?: string) {
  const id = String(customerId || "").trim();
  return id ? { customerId: id } : undefined;
}

export function normalizeFlow2ThinkingLevel(value: unknown): Flow2ThinkingLevel {
  const normalized = String(value || DEFAULT_FLOW2_THINKING_LEVEL)
    .trim()
    .toUpperCase();
  if ((FLOW2_TEXT_THINKING_LEVELS as readonly string[]).includes(normalized)) {
    return normalized as Flow2ThinkingLevel;
  }
  return DEFAULT_FLOW2_THINKING_LEVEL;
}

function pickNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function parseUsage(value: unknown): Flow2TextUsage | null {
  if (!isRecord(value)) return null;
  const usage: Flow2TextUsage = {
    promptTokenCount: pickNumber(value.promptTokenCount ?? value.prompt_token_count),
    candidatesTokenCount: pickNumber(value.candidatesTokenCount ?? value.candidates_token_count),
    thoughtsTokenCount: pickNumber(value.thoughtsTokenCount ?? value.thoughts_token_count),
    totalTokenCount: pickNumber(value.totalTokenCount ?? value.total_token_count),
  };
  return Object.values(usage).some((item) => item != null) ? usage : null;
}

function parseJsonResult(value: unknown): Record<string, unknown> | unknown[] | null {
  if (value == null) return null;
  if (Array.isArray(value) || isRecord(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && (Array.isArray(parsed) || isRecord(parsed))) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

/** Lấy object `result` từ poll Flow2 gen_text. */
export function pickFlow2TextResultPayload(
  statusData: Flow2StatusResponse
): Record<string, unknown> | null {
  const candidates: unknown[] = [
    statusData.result,
    (statusData.data as Record<string, unknown> | undefined)?.result,
    (statusData.request as Record<string, unknown> | undefined)?.result,
  ];
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    if (
      typeof candidate.text === "string" ||
      candidate.json != null ||
      candidate.usage != null ||
      typeof candidate.model === "string"
    ) {
      return candidate;
    }
  }
  return null;
}

export function extractFlow2TextResult(statusData: Flow2StatusResponse): Flow2TextResult | null {
  const payload = pickFlow2TextResultPayload(statusData);
  if (!payload) return null;

  const text = typeof payload.text === "string" ? payload.text : "";
  const json = parseJsonResult(payload.json);
  const usage = parseUsage(payload.usage);
  const model = typeof payload.model === "string" ? payload.model : undefined;
  const thinkingLevel =
    typeof payload.thinking_level === "string"
      ? payload.thinking_level
      : typeof payload.thinkingLevel === "string"
      ? payload.thinkingLevel
      : undefined;
  const finishReason =
    typeof payload.finish_reason === "string"
      ? payload.finish_reason
      : typeof payload.finishReason === "string"
      ? payload.finishReason
      : undefined;
  const profileId =
    typeof payload.profile_id === "string"
      ? payload.profile_id
      : typeof payload.profileId === "string"
      ? payload.profileId
      : undefined;

  if (!text && json == null) return null;
  return { text, json, usage, model, thinkingLevel, finishReason, profileId };
}

export function serializeFlow2TextClientResult(result: Flow2TextResult | null) {
  if (!result) return null;
  return {
    text: result.text,
    json: result.json,
    usage: result.usage,
    model: result.model,
    thinking_level: result.thinkingLevel,
    finish_reason: result.finishReason,
    profile_id: result.profileId,
  };
}

export function sanitizeFlow2TextStatus(statusData: Flow2StatusResponse) {
  const requestId = pickFlow2RequestId(statusData) || "";
  const rawStatus = pickStatus(statusData);
  const result = extractFlow2TextResult(statusData);
  const error = pickError(statusData);

  let status = rawStatus || "queued";
  if (isFlow2SuccessStatus(rawStatus)) status = "done";
  else if (isFlow2FailedStatus(rawStatus)) status = "failed";

  return {
    id: requestId,
    status,
    type: "gen_text",
    result: serializeFlow2TextClientResult(result),
    error: status === "failed" ? error : undefined,
  };
}

export async function normalizeAudioToDataUrl(input: Flow2AudioInput): Promise<string> {
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) throw new Error("Audio đầu vào rỗng");
    if (trimmed.startsWith("data:")) return trimmed;
    const stripped = stripDataUrlFromBase64(trimmed, "audio/mpeg");
    return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
  }

  const stripped = stripDataUrlFromBase64(input.audioBytes, input.mimeType || "audio/mpeg");
  return `data:${stripped.mimeType};base64,${stripped.imageBytes}`;
}

export async function createFlow2TextRequest(
  params: Flow2CreateTextRequestParams
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const prompt = String(params.prompt || "").trim();
  if (!prompt) {
    throw Object.assign(new Error("Thiếu prompt"), { statusCode: 400 });
  }

  const imageInputs = (params.imageInputs || []).slice(0, MAX_FLOW2_TEXT_IMAGES);
  const audioInputs = (params.audioInputs || []).slice(0, MAX_FLOW2_TEXT_AUDIOS);
  const image_base64s = await Promise.all(imageInputs.map(normalizeImageToDataUrl));
  const audio_base64s = await Promise.all(audioInputs.map(normalizeAudioToDataUrl));
  const systemInstruction = String(params.systemInstruction || "").trim();
  const model = String(params.model || DEFAULT_FLOW2_TEXT_MODEL).trim() || DEFAULT_FLOW2_TEXT_MODEL;
  const thinkingLevel = normalizeFlow2ThinkingLevel(params.thinkingLevel);

  const useJsonMode = params.jsonMode === true || params.jsonSchema != null;

  return createFlow2Request(
    {
      type: "gen_text",
      params: {
        prompt,
        ...(systemInstruction ? { system_instruction: systemInstruction } : {}),
        model,
        thinking_level: thinkingLevel,
        ...(image_base64s.length > 0 ? { image_base64s } : {}),
        ...(audio_base64s.length > 0 ? { audio_base64s } : {}),
        ...(useJsonMode ? { json: true, response_mime_type: "application/json" } : {}),
        ...(params.jsonSchema ? { schema: params.jsonSchema } : {}),
      },
    },
    flow2Opts(params.customerId)
  );
}

export async function getFlow2TextRequestStatus(
  requestId: string,
  customerId?: string
): Promise<Flow2StatusResponse> {
  const id = String(requestId || "").trim();
  if (!id) throw Object.assign(new Error("Thiếu request id"), { statusCode: 400 });
  return getFlow2RequestStatus(id, flow2Opts(customerId));
}

export async function cancelFlow2TextRequest(
  requestId: string,
  customerId?: string
): Promise<boolean> {
  const id = String(requestId || "").trim();
  if (!id) throw Object.assign(new Error("Thiếu request id"), { statusCode: 400 });
  return cancelFlow2Request(id, flow2Opts(customerId));
}

export async function waitForFlow2TextResult(params: {
  requestId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  onProgress?: (progress: number, message?: string) => void | Promise<void>;
  customerId?: string;
}): Promise<Flow2TextResult> {
  const [result] = await waitForFlow2Result<Flow2TextResult>({
    requestId: params.requestId,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
    onProgress: params.onProgress,
    extract: async (statusData) => {
      const item = extractFlow2TextResult(statusData);
      return item ? [item] : [];
    },
    emptyResultMessage: "Flow2 hoàn tất nhưng không có text đầu ra",
    waitingProgressMessage: "Đang chờ Flow2 generate text...",
    doneProgressMessage: "Flow2 đã generate text xong, đang xử lý kết quả...",
    logTag: "text",
    customerId: params.customerId,
  });
  return result;
}

// ---------- Per-customer concurrency limiter ----------

/** Số request gen_text song song tối đa cho 1 customerId */
const FLOW2_TEXT_MAX_CONCURRENT_PER_CUSTOMER = 10;

/** active count per customerId (in-memory, reset on restart) */
const _textConcurrentMap = new Map<string, number>();

function _textConcurrentGet(customerId: string): number {
  return _textConcurrentMap.get(customerId) ?? 0;
}

function _textConcurrentInc(customerId: string): void {
  _textConcurrentMap.set(customerId, _textConcurrentGet(customerId) + 1);
}

function _textConcurrentDec(customerId: string): void {
  const next = Math.max(0, _textConcurrentGet(customerId) - 1);
  if (next === 0) _textConcurrentMap.delete(customerId);
  else _textConcurrentMap.set(customerId, next);
}

function checkFlow2TextConcurrentLimit(customerId?: string): void {
  if (!customerId) return;
  const current = _textConcurrentGet(customerId);
  if (current >= FLOW2_TEXT_MAX_CONCURRENT_PER_CUSTOMER) {
    throw Object.assign(
      new Error(
        `Đã đạt giới hạn ${FLOW2_TEXT_MAX_CONCURRENT_PER_CUSTOMER} request gen_text song song cho tài khoản này. Vui lòng thử lại sau.`
      ),
      { statusCode: 429 }
    );
  }
}

// ------------------------------------------------------

export async function generateTextWithFlow2(
  params: Flow2CreateTextRequestParams
): Promise<{ requestId: string; result: Flow2TextResult }> {
  const customerId = params.customerId;
  checkFlow2TextConcurrentLimit(customerId);
  if (customerId) _textConcurrentInc(customerId);
  try {
    return await runFlow2WithRetry({
      logTag: "text",
      onProgress: params.onProgress,
      createProgressMessage: "Đang gửi request generate text lên Flow2...",
      createdProgressMessage: () => "",
      retryProgressMessage: (attempt) => `Flow2 gặp lỗi tạm thời, đang retry lần ${attempt}...`,
      runOnce: async () => {
        const created = await createFlow2TextRequest(params);
        await params.onRequestCreated?.(created.requestId);
        await safeProgress(
          params.onProgress,
          55,
          `Đã tạo request Flow2 (${created.requestId}), đang chờ kết quả...`
        );
        const result = await waitForFlow2TextResult({
          requestId: created.requestId,
          onProgress: params.onProgress,
          customerId: params.customerId,
        });
        return { requestId: created.requestId, result };
      },
    });
  } finally {
    if (customerId) _textConcurrentDec(customerId);
  }
}
