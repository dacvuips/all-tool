import { Response } from "express";

/** Trả lỗi enqueue — gắn Retry-After khi 429 để client backoff đúng. */
export function sendEnqueueErrorResponse(res: Response, err: unknown): void {
  const e = err as { statusCode?: number; message?: string; retryAfterMs?: number };
  const status = typeof e?.statusCode === "number" ? e.statusCode : 500;
  const message = String(e?.message || "Lỗi server");
  if (status === 429 && typeof e?.retryAfterMs === "number" && e.retryAfterMs > 0) {
    res.setHeader("Retry-After", String(Math.ceil(e.retryAfterMs / 1000)));
  }
  res.status(status).json({ message });
}
