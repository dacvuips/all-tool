import { Response } from "express";

export type GenerationSSESender = (data: Record<string, unknown>) => void;

/** Mở SSE sớm để proxy/browser không timeout (504) khi xử lý captcha/upload lâu. */
export function initGenerationSSE(res: Response): GenerationSSESender {
  if (!res.headersSent) {
    res.status(200);
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    if (typeof res.flushHeaders === "function") {
      res.flushHeaders();
    }
  }
  return (data) => {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    }
  };
}

export function isGenerationSSE(res: Response): boolean {
  if (!res.headersSent) return false;
  const contentType = res.getHeader("Content-Type");
  return String(contentType).includes("event-stream");
}

export function sendGenerationSSEError(res: Response, message: string, statusCode = 500): void {
  if (res.headersSent) {
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: "error", message })}\n\n`);
      res.end();
    }
    return;
  }
  res.status(statusCode).json({ message });
}

/** @deprecated Use initGenerationSSE */
export const initVideoGenerationSSE = initGenerationSSE;
/** @deprecated Use sendGenerationSSEError */
export const sendVideoGenerationSSEError = sendGenerationSSEError;
export type VideoGenerationSSESender = GenerationSSESender;
