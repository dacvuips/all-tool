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
        `Chưa cấu hình setting key "${MICROX_VOICE_API_KEY_KEY}" (Admin → Settings → MicroX Voice)`
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
    const msg =
      data?.message || data?.error || data?.detail || `MicroX API lỗi ${res.status}`;
    throw Object.assign(new Error(String(msg)), {
      statusCode: res.status,
      body: data,
    });
  }

  return { status: res.status, data };
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
