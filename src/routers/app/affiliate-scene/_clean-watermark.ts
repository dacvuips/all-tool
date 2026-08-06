/**
 * Gọi Flow2 API xóa logo / watermark (sync base64).
 * Ảnh: Erasio (Gemini sparkle) · Video: crop/inpaint
 */
import logger from "../../../helpers/logger";
import { getFlow2Config } from "../../api-media/flow2/_shared";

export const WATERMARK_IMAGE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const WATERMARK_VIDEO_MAX_BYTES = 50 * 1024 * 1024; // 50MB

export const WATERMARK_ACCEPTED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const WATERMARK_ACCEPTED_VIDEO_MIMES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

export type CleanWatermarkKind = "image" | "video";

export type Flow2CleanWatermarkResult = {
  success: boolean;
  cleaned?: boolean;
  kind?: CleanWatermarkKind;
  mime_type?: string;
  media_base64?: string;
  url?: string;
  Link?: string;
  request_id?: string;
  elapsed_seconds?: number;
  message?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Ước lượng kích thước binary từ chuỗi base64 (có/không data URL). */
export function estimateBase64ByteLength(raw: string): number {
  const trimmed = (raw || "").trim();
  if (!trimmed) return 0;
  const pure = trimmed.includes(",") ? trimmed.split(",").pop() || "" : trimmed;
  const cleaned = pure.replace(/\s/g, "");
  if (!cleaned) return 0;
  const padding = cleaned.endsWith("==") ? 2 : cleaned.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((cleaned.length * 3) / 4) - padding);
}

export function stripDataUrlPrefix(raw: string): { pureBase64: string; mimeType?: string } {
  const trimmed = (raw || "").trim();
  const match = /^data:([^;]+);base64,(.+)$/i.exec(trimmed);
  if (match) {
    return { pureBase64: match[2].replace(/\s/g, ""), mimeType: match[1].toLowerCase() };
  }
  return { pureBase64: trimmed.replace(/\s/g, "") };
}

export function ensureDataUrl(raw: string, fallbackMime: string): string {
  const trimmed = (raw || "").trim();
  if (/^data:[^;]+;base64,/i.test(trimmed)) return trimmed;
  return `data:${fallbackMime};base64,${trimmed.replace(/\s/g, "")}`;
}

async function fetchMediaUrlAsBase64(
  url: string,
  token: string
): Promise<{ base64: string; mimeType?: string }> {
  const headers: Record<string, string> = { Authorization: `Bearer ${token}` };
  let resp = await fetch(url, { headers });
  if (!resp.ok) {
    resp = await fetch(url);
  }
  if (!resp.ok) {
    throw new Error(`Không tải được media (${resp.status})`);
  }
  const mimeType = resp.headers.get("content-type")?.split(";")[0]?.trim() || undefined;
  const buf = Buffer.from(await resp.arrayBuffer());
  if (!buf.length) throw new Error("Media URL trả về rỗng");
  return { base64: buf.toString("base64"), mimeType };
}

export function normalizeMimeType(mime?: string, kind: CleanWatermarkKind = "image"): string {
  const m = (mime || "").toLowerCase().split(";")[0].trim();
  if (m === "image/jpg") return "image/jpeg";
  if (m) return m;
  return kind === "video" ? "video/mp4" : "image/jpeg";
}

export function validateMediaPayload(args: {
  kind: CleanWatermarkKind;
  base64: string;
  mimeType?: string;
}): { mimeType: string; byteLength: number; dataUrl: string } {
  const { kind, base64 } = args;
  if (!base64?.trim()) {
    const err: any = new Error(kind === "video" ? "Thiếu video_base64" : "Thiếu image_base64");
    err.statusCode = 400;
    throw err;
  }

  const stripped = stripDataUrlPrefix(base64);
  const mimeType = normalizeMimeType(args.mimeType || stripped.mimeType, kind);
  const allowed =
    kind === "video" ? WATERMARK_ACCEPTED_VIDEO_MIMES : WATERMARK_ACCEPTED_IMAGE_MIMES;
  if (!allowed.has(mimeType)) {
    const err: any = new Error(
      kind === "video"
        ? "Định dạng video không hỗ trợ. Chỉ chấp nhận MP4, WebM, MOV."
        : "Định dạng ảnh không hỗ trợ. Chỉ chấp nhận JPG, PNG, WebP, GIF."
    );
    err.statusCode = 400;
    throw err;
  }

  const byteLength = estimateBase64ByteLength(base64);
  const maxBytes = kind === "video" ? WATERMARK_VIDEO_MAX_BYTES : WATERMARK_IMAGE_MAX_BYTES;
  if (byteLength > maxBytes) {
    const maxMb = Math.round(maxBytes / (1024 * 1024));
    const sizeMb = (byteLength / (1024 * 1024)).toFixed(1);
    const err: any = new Error(
      kind === "video"
        ? `Video vượt quá giới hạn ${maxMb}MB (file: ${sizeMb}MB).`
        : `Ảnh vượt quá giới hạn ${maxMb}MB (file: ${sizeMb}MB).`
    );
    err.statusCode = 400;
    throw err;
  }

  return {
    mimeType,
    byteLength,
    dataUrl: ensureDataUrl(base64, mimeType),
  };
}

export async function cleanWatermarkViaFlow2(args: {
  kind: CleanWatermarkKind;
  dataUrl: string;
  returnMode?: "base64" | "url" | "both";
}): Promise<Flow2CleanWatermarkResult> {
  const { baseUrl, token } = await getFlow2Config();
  const returnMode = args.returnMode || "both";
  const body: Record<string, string> =
    args.kind === "video"
      ? { video_base64: args.dataUrl, return_mode: returnMode }
      : { image_base64: args.dataUrl, return_mode: returnMode };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10 * 60 * 1000);

  try {
    const resp = await fetch(`${baseUrl}/api/watermark/clean`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    const text = await resp.text();
    let json: unknown = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }

    if (!resp.ok) {
      const msg =
        (isRecord(json) && (String(json.message || json.error || "") || "")) ||
        text?.slice(0, 300) ||
        `Flow2 watermark clean lỗi HTTP ${resp.status}`;
      logger.error(`[clean-watermark] Flow2 ${resp.status}: ${msg}`);
      const err: any = new Error(msg);
      err.statusCode = resp.status >= 400 && resp.status < 600 ? resp.status : 502;
      throw err;
    }

    if (!isRecord(json)) {
      throw Object.assign(new Error("Flow2 watermark clean trả về không hợp lệ"), {
        statusCode: 502,
      });
    }

    // Hỗ trợ payload bọc trong data / result
    const payload: Record<string, unknown> = isRecord(json.data)
      ? { ...json, ...(json.data as Record<string, unknown>) }
      : isRecord(json.result)
      ? { ...json, ...(json.result as Record<string, unknown>) }
      : json;

    let mediaBase64Raw =
      (typeof payload.media_base64 === "string" && payload.media_base64) ||
      (typeof payload.image_base64 === "string" && payload.image_base64) ||
      (typeof payload.video_base64 === "string" && payload.video_base64) ||
      (typeof payload.base64 === "string" && payload.base64) ||
      (typeof payload.data_url === "string" && payload.data_url) ||
      "";

    const mediaUrl =
      (typeof payload.url === "string" && payload.url) ||
      (typeof payload.Link === "string" && payload.Link) ||
      (typeof payload.image_url === "string" && payload.image_url) ||
      (typeof payload.video_url === "string" && payload.video_url) ||
      undefined;

    let mimeType =
      (typeof payload.mime_type === "string" && payload.mime_type) ||
      (args.kind === "video" ? "video/mp4" : "image/jpeg");

    // Chỉ có URL → tải bytes để client luôn có base64 xem preview
    if (!mediaBase64Raw && mediaUrl) {
      try {
        const fetched = await fetchMediaUrlAsBase64(mediaUrl, token);
        mediaBase64Raw = fetched.base64;
        if (fetched.mimeType) mimeType = fetched.mimeType;
      } catch (fetchErr: any) {
        logger.warn(`[clean-watermark] Tải media URL thất bại: ${fetchErr?.message}`);
      }
    }

    if (!mediaBase64Raw && !mediaUrl) {
      throw Object.assign(new Error("Flow2 không trả về media đã xóa watermark"), {
        statusCode: 502,
      });
    }

    return {
      success: payload.success !== false,
      cleaned: payload.cleaned !== false,
      kind: (payload.kind as CleanWatermarkKind) || args.kind,
      mime_type: mimeType,
      media_base64: mediaBase64Raw ? stripDataUrlPrefix(mediaBase64Raw).pureBase64 : undefined,
      url: mediaUrl,
      Link: typeof payload.Link === "string" ? payload.Link : undefined,
      request_id:
        typeof payload.request_id === "string"
          ? payload.request_id
          : typeof payload.requestId === "string"
          ? payload.requestId
          : undefined,
      elapsed_seconds:
        typeof payload.elapsed_seconds === "number" ? payload.elapsed_seconds : undefined,
      message: typeof payload.message === "string" ? payload.message : undefined,
    };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw Object.assign(new Error("Timeout khi xóa watermark (quá 10 phút)"), {
        statusCode: 504,
      });
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
