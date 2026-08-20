import logger from "../../../helpers/logger";
import { id12 } from "../../../helpers/nanoid";
import { SettingHelper } from "../../../packages/setting-helper";

export const MICROX_VOICE_BASE_URL_KEY = "microx-voice-base-url";
export const MICROX_VOICE_API_KEY_KEY = "microx-voice-api-key";

const DEFAULT_MICROX_BASE_URL = "https://www.microx.app/api/v1";

export type MicroxCreds = {
  baseUrl: string;
  apiKey: string;
};

export async function resolveMicroxCreds(): Promise<MicroxCreds> {
  let settingBase = "";
  let settingKey = "";
  try {
    const [baseUrlRaw, apiKeyRaw] = await SettingHelper.loadMany(
      [MICROX_VOICE_BASE_URL_KEY, MICROX_VOICE_API_KEY_KEY],
      { secure: false }
    );
    settingBase = String(baseUrlRaw ?? "").trim();
    settingKey = String(apiKeyRaw ?? "").trim();
  } catch (err: any) {
    logger.warn(`[microx] Không đọc được setting: ${err?.message || err}`);
  }

  const baseUrl = (settingBase || process.env.MICROX_BASE_URL || DEFAULT_MICROX_BASE_URL).replace(
    /\/+$/,
    ""
  );
  const apiKey = settingKey || String(process.env.MICROX_API_KEY || "").trim();

  if (!apiKey) {
    throw Object.assign(
      new Error(
        `Chưa cấu hình setting key "${MICROX_VOICE_API_KEY_KEY}" (Admin → Settings → Viettheo Voice)`
      ),
      { statusCode: 500 }
    );
  }

  return { baseUrl, apiKey };
}

export function newIdempotencyKey(prefix: string): string {
  return `${prefix}-${id12()}`;
}

export async function microxFetch(
  path: string,
  init: {
    method?: string;
    json?: unknown;
    form?: FormData;
    query?: Record<string, string | number | undefined | null>;
    idempotencyKey?: string;
  } = {}
): Promise<{ status: number; data: any }> {
  const { baseUrl, apiKey } = await resolveMicroxCreds();
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  if (init.query) {
    for (const [k, v] of Object.entries(init.query)) {
      if (v === undefined || v === null || String(v).trim() === "") continue;
      url.searchParams.set(k, String(v));
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
  };
  if (init.idempotencyKey) {
    headers["Idempotency-Key"] = init.idempotencyKey;
  }

  let body: BodyInit | undefined;
  if (init.json !== undefined) {
    headers["Content-Type"] = "application/json; charset=utf-8";
    body = JSON.stringify(init.json);
  } else if (init.form) {
    body = init.form;
  }

  logger.info(`[microx] ${init.method || "GET"} ${url.pathname}${url.search}`);

  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers,
    body,
  });

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
  }

  if (!res.ok) {
    const msg = data?.message || data?.error || data?.detail || `VietTheo API lỗi ${res.status}`;
    throw Object.assign(new Error(String(msg)), {
      statusCode: res.status,
      body: data,
    });
  }

  return { status: res.status, data };
}

export async function microxFetchBuffer(
  path: string,
  init: { method?: string } = {}
): Promise<{ status: number; buffer: Buffer; contentType: string }> {
  const { baseUrl, apiKey } = await resolveMicroxCreds();
  const url = new URL(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`);
  logger.info(`[microx] ${init.method || "GET"} ${url.pathname}${url.search}`);

  const res = await fetch(url.toString(), {
    method: init.method || "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  const arrayBuf = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuf);
  const contentType = res.headers.get("content-type") || "application/octet-stream";

  if (!res.ok) {
    let message = `VietTheo API lỗi ${res.status}`;
    try {
      const parsed = JSON.parse(buffer.toString("utf8"));
      message = parsed?.message || parsed?.error || parsed?.detail || message;
    } catch {
      // binary error body
    }
    throw Object.assign(new Error(String(message)), {
      statusCode: res.status,
    });
  }

  return { status: res.status, buffer, contentType };
}

async function fetchRemoteAudio(url: string): Promise<{ buffer: Buffer; contentType: string }> {
  const signed = /X-Amz-Signature=|X-Amz-Algorithm=/i.test(url) || /cloudflarestorage\.com/i.test(url);
  const headers: Record<string, string> = {};
  if (!signed) {
    const { apiKey } = await resolveMicroxCreds();
    headers.Authorization = `Bearer ${apiKey}`;
  }
  let res = await fetch(url, Object.keys(headers).length ? { headers } : undefined);
  if (!res.ok && !signed && (res.status === 400 || res.status === 403)) {
    res = await fetch(url);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (!res.ok) {
    throw Object.assign(new Error(`Tải audio job lỗi ${res.status}`), {
      statusCode: res.status,
    });
  }
  return {
    buffer,
    contentType: res.headers.get("content-type") || "audio/mpeg",
  };
}

export async function microxFetchVoicePreview(
  voiceId: string
): Promise<{ buffer: Buffer; contentType: string }> {
  const first = await microxFetchBuffer(`/voices/${encodeURIComponent(voiceId)}/preview`);
  const ct = first.contentType.toLowerCase();
  if (!ct.includes("application/json") && !ct.includes("text/")) {
    return { buffer: first.buffer, contentType: first.contentType };
  }
  try {
    const parsed = JSON.parse(first.buffer.toString("utf8"));
    const nested = parsed?.url || parsed?.preview_url || parsed?.audio_url || parsed?.sample_url;
    if (typeof nested === "string" && /^https?:\/\//i.test(nested)) {
      return fetchRemoteAudio(nested);
    }
  } catch (err: any) {
    if (err?.statusCode) throw err;
  }
  return { buffer: first.buffer, contentType: first.contentType };
}

export function unwrapMicroxJob(payload: any): any {
  if (!payload || typeof payload !== "object") return payload;
  const inner = payload.data;
  if (
    inner &&
    typeof inner === "object" &&
    !Array.isArray(inner) &&
    (inner.id || inner.status || inner.result)
  ) {
    return inner;
  }
  return payload;
}

function isExternalAudioUrl(value: string, key = ""): boolean {
  if (!/^https?:\/\//i.test(value)) return false;
  if (/audio|url|output|download|file|preview|sample/i.test(key)) return true;
  if (/\.(mp3|wav|m4a|ogg|flac)(\?|$)/i.test(value)) return true;
  if (/cloudflarestorage|amazonaws|microx/i.test(value)) return true;
  return false;
}

/** Ẩn presigned MicroX, thay bằng link proxy của tool. */
export function sanitizeJobForClient(payload: any): any {
  const job = unwrapMicroxJob(payload);
  if (!job || typeof job !== "object") return job;
  const copy = JSON.parse(JSON.stringify(job));
  const jobId = String(copy.id || "").trim();
  if (!jobId) return copy;
  let index = 0;
  const rewrite = (node: any, key = "") => {
    if (node == null) return;
    if (typeof node === "string") return;
    if (Array.isArray(node)) {
      node.forEach((item, i) => {
        if (typeof item === "string" && isExternalAudioUrl(item, key)) {
          node[i] = `/api/app/voice/jobs/${encodeURIComponent(jobId)}/output/?index=${index}`;
          index += 1;
        } else {
          rewrite(item, key);
        }
      });
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (typeof v === "string" && isExternalAudioUrl(v, k)) {
          node[k] = `/api/app/voice/jobs/${encodeURIComponent(jobId)}/output/?index=${index}`;
          index += 1;
        } else {
          rewrite(v, k);
        }
      }
    }
  };
  rewrite(copy);
  return copy;
}

export function collectHttpUrls(value: unknown, out: string[] = []): string[] {
  if (value == null) return out;
  if (typeof value === "string") {
    const v = value.trim();
    if (/^https?:\/\//i.test(v) && !out.includes(v)) out.push(v);
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectHttpUrls(item, out));
    return out;
  }
  if (typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      collectHttpUrls(nested, out);
    }
  }
  return out;
}

export async function microxFetchJobOutput(
  jobId: string,
  index = 0
): Promise<{ buffer: Buffer; contentType: string }> {
  const { data } = await microxFetch(`/jobs/${encodeURIComponent(jobId)}`);
  const job = unwrapMicroxJob(data);
  const preferred = job?.result?.audio_url || job?.audio_url;
  const urls = collectHttpUrls(job);
  const ordered = [
    ...(typeof preferred === "string" && /^https?:\/\//i.test(preferred) ? [preferred] : []),
    ...urls.filter((item) => item !== preferred),
  ];
  const target = ordered[index];
  if (!target) {
    throw Object.assign(new Error("Job chưa có file audio"), { statusCode: 404 });
  }
  return fetchRemoteAudio(target);
}

export function audioFileFromMulter(file: Express.Multer.File): { blob: Blob; filename: string } {
  const filename = file.originalname || "audio.mp3";
  const type = file.mimetype || "audio/mpeg";
  const bytes = new Uint8Array(file.buffer);
  if (typeof File !== "undefined") {
    return { blob: new File([bytes], filename, { type }), filename };
  }
  return { blob: new Blob([bytes], { type }), filename };
}

export function sendRouteError(res: import("express").Response, err: any) {
  const status = Number(err?.statusCode) || 500;
  logger.error(`[voice] ${err?.message || err}`);
  res.status(status).json({
    message: err?.message || "Lỗi server",
    data: err?.body,
  });
}
