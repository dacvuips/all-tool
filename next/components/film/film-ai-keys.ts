/**
 * Film API Keys — lưu bảng Credential trên server (encrypt).
 * Frontend chỉ biết đã lưu / chưa lưu; không đọc, không ghi, không hiện plaintext.
 */

export const FILM_DEFAULT_GATEWAY_MODEL = "gpt-5-5";

/** Legacy localStorage (scrape / film cũ) — chỉ dùng để migrate 1 lần lên server. */
const LEGACY_OPENAI_KEY_LS = "video-affiliate-plus-scrape-openai-key";
const LEGACY_GEMINI_KEY_LS = "video-affiliate-plus-scrape-gemini-key";
const LEGACY_GATEWAY_ENDPOINT_LS = "video-affiliate-plus-scrape-gateway-endpoint";
const LEGACY_GATEWAY_API_KEY_LS = "video-affiliate-plus-scrape-gateway-api-key";
const LEGACY_GATEWAY_MODEL_LS = "video-affiliate-plus-scrape-gateway-model";

export type FilmAiProvider = "gateway" | "openai" | "gemini";

export type FilmAiKeysStatus = {
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
  hasGateway: boolean;
  hasAnyAi: boolean;
  /** Không phải secret — cho phép sửa endpoint/model khi đã lưu key. */
  gatewayEndpoint: string;
  gatewayModel: string;
};

export type FilmAiKeysSaveInput = {
  openaiKey?: string;
  geminiKey?: string;
  gatewayEndpoint?: string;
  gatewayApiKey?: string;
  gatewayModel?: string;
};

export const EMPTY_FILM_AI_KEYS_STATUS: FilmAiKeysStatus = {
  hasOpenaiKey: false,
  hasGeminiKey: false,
  hasGateway: false,
  hasAnyAi: false,
  gatewayEndpoint: "",
  gatewayModel: "",
};

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function normalizeStatus(raw: any): FilmAiKeysStatus {
  const hasOpenaiKey = Boolean(raw?.hasOpenaiKey);
  const hasGeminiKey = Boolean(raw?.hasGeminiKey);
  const hasGateway = Boolean(raw?.hasGateway);
  return {
    hasOpenaiKey,
    hasGeminiKey,
    hasGateway,
    hasAnyAi: Boolean(raw?.hasAnyAi) || hasGateway || hasOpenaiKey || hasGeminiKey,
    gatewayEndpoint: asString(raw?.gatewayEndpoint),
    gatewayModel: asString(raw?.gatewayModel),
  };
}

export async function fetchFilmAiKeysStatus(): Promise<FilmAiKeysStatus> {
  const res = await fetch("/api/app/film/ai-credentials/", {
    method: "GET",
    credentials: "include",
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Không tải được trạng thái API Key (${res.status})`);
  }
  return normalizeStatus(body?.data);
}

export async function saveFilmAiKeysToServer(
  input: FilmAiKeysSaveInput
): Promise<FilmAiKeysStatus> {
  const res = await fetch("/api/app/film/ai-credentials/", {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      openaiKey: asString(input.openaiKey) || undefined,
      geminiKey: asString(input.geminiKey) || undefined,
      gatewayEndpoint: asString(input.gatewayEndpoint) || undefined,
      gatewayApiKey: asString(input.gatewayApiKey) || undefined,
      gatewayModel: asString(input.gatewayModel) || undefined,
    }),
  });
  const body = await res.json().catch(() => ({} as any));
  if (!res.ok) {
    throw new Error(body?.message || `Lưu API Key thất bại (${res.status})`);
  }
  return normalizeStatus(body?.data);
}

function readLegacyLs(key: string): string {
  if (typeof window === "undefined") return "";
  try {
    return asString(localStorage.getItem(key));
  } catch {
    return "";
  }
}

function clearLegacyLs(key: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(key);
  } catch {
    /* ignore */
  }
}

/** Đẩy key cũ từ localStorage lên Credential rồi xóa khỏi trình duyệt. */
export async function migrateFilmAiKeysFromLocalStorage(): Promise<FilmAiKeysStatus | null> {
  const openaiKey = readLegacyLs(LEGACY_OPENAI_KEY_LS);
  const geminiKey = readLegacyLs(LEGACY_GEMINI_KEY_LS);
  const gatewayEndpoint = readLegacyLs(LEGACY_GATEWAY_ENDPOINT_LS);
  const gatewayApiKey = readLegacyLs(LEGACY_GATEWAY_API_KEY_LS);
  const gatewayModel = readLegacyLs(LEGACY_GATEWAY_MODEL_LS);
  const hasLegacy = Boolean(
    openaiKey || geminiKey || (gatewayEndpoint && gatewayApiKey && gatewayModel)
  );
  if (!hasLegacy) return null;

  let status: FilmAiKeysStatus;
  try {
    status = await fetchFilmAiKeysStatus();
  } catch {
    return null;
  }

  const payload: FilmAiKeysSaveInput = {};
  if (openaiKey && !status.hasOpenaiKey) payload.openaiKey = openaiKey;
  if (geminiKey && !status.hasGeminiKey) payload.geminiKey = geminiKey;
  if (gatewayApiKey && !status.hasGateway) {
    payload.gatewayEndpoint = gatewayEndpoint;
    payload.gatewayApiKey = gatewayApiKey;
    payload.gatewayModel = gatewayModel || FILM_DEFAULT_GATEWAY_MODEL;
  }

  if (payload.openaiKey || payload.geminiKey || payload.gatewayApiKey) {
    status = await saveFilmAiKeysToServer(payload);
  }

  clearLegacyLs(LEGACY_OPENAI_KEY_LS);
  clearLegacyLs(LEGACY_GEMINI_KEY_LS);
  clearLegacyLs(LEGACY_GATEWAY_ENDPOINT_LS);
  clearLegacyLs(LEGACY_GATEWAY_API_KEY_LS);
  clearLegacyLs(LEGACY_GATEWAY_MODEL_LS);
  return status;
}
