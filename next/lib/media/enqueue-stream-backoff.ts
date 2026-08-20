/**
 * Điều phối retry enqueue khi hết slot luồng (429) — tránh spam POST gây quá tải server.
 * Dùng chung mọi tool tạo ảnh/video trong cùng tab.
 */
import { MediaGenerationJobError } from "../hooks/useMediaGenerationJob";

/** Tối đa số lần thử enqueue khi 429 (~30 phút với backoff). */
export const MAX_STREAM_ENQUEUE_ATTEMPTS = 60;

/** Thời gian chờ tối đa cho một lần enqueue (ms). */
export const STREAM_ENQUEUE_MAX_WAIT_MS = 20 * 60 * 1000;

const MIN_STREAM_RETRY_MS = 8000;
const MAX_STREAM_RETRY_MS = 30000;

/** Thời điểm sớm nhất mọi luồng được phép enqueue lại (global trong tab). */
let globalStreamBlockedUntil = 0;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isStreamLimitEnqueueError(err: unknown): boolean {
  if (!(err instanceof MediaGenerationJobError) || err.code !== "ENQUEUE_FAILED") {
    return false;
  }
  if (err.httpStatus === 429) return true;
  return /giới hạn luồng|quá nhiều yêu cầu tạo media/i.test(String(err.message || ""));
}

export function isStreamLimitHttpStatus(status: number, message?: string): boolean {
  if (status === 429) return true;
  return /giới hạn luồng|quá nhiều yêu cầu tạo media/i.test(String(message || ""));
}

/** Backoff: 8s → 13s → … tối đa 30s. */
export function computeStreamEnqueueBackoffMs(attempt: number): number {
  const ms = MIN_STREAM_RETRY_MS + attempt * 5000;
  return Math.min(MAX_STREAM_RETRY_MS, ms);
}

export function notifyStreamLimitHit(retryAfterMs?: number): void {
  const extra =
    Number.isFinite(retryAfterMs) && retryAfterMs! > 0 ? retryAfterMs! : MIN_STREAM_RETRY_MS;
  globalStreamBlockedUntil = Math.max(globalStreamBlockedUntil, Date.now() + extra);
}

/** Chờ slot + backoff trước khi POST enqueue lại. */
export async function waitBeforeStreamEnqueueRetry(
  attempt: number,
  options?: { isCancelled?: () => boolean; retryAfterMs?: number }
): Promise<void> {
  notifyStreamLimitHit(options?.retryAfterMs ?? computeStreamEnqueueBackoffMs(attempt));

  while (Date.now() < globalStreamBlockedUntil) {
    if (options?.isCancelled?.()) {
      throw new MediaGenerationJobError("Đã dừng", "JOB_CANCELLED");
    }
    const remaining = globalStreamBlockedUntil - Date.now();
    await sleep(Math.min(1000, Math.max(250, remaining)));
  }

  const backoffMs = computeStreamEnqueueBackoffMs(attempt);
  await sleep(backoffMs);
}

export function parseRetryAfterMs(res: Response): number | undefined {
  const header = res.headers.get("Retry-After");
  if (!header) return undefined;
  const sec = Number(header);
  if (Number.isFinite(sec) && sec > 0) return sec * 1000;
  const dateMs = Date.parse(header);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : undefined;
  }
  return undefined;
}

export type FrontendJobQueue = {
  limit: number;
  active: () => number;
  waiting: () => number;
  acquire: () => Promise<void>;
  release: () => void;
};

/** Hàng đợi frontend: tối đa `limit` job chạy cùng lúc, phần còn lại chờ tại chỗ. */
export function createFrontendJobQueue(limit: number): FrontendJobQueue {
  const max = Math.max(1, Math.min(50, Math.round(limit || 1)));
  let active = 0;
  const waiters: Array<() => void> = [];
  return {
    limit: max,
    active: () => active,
    waiting: () => waiters.length,
    async acquire() {
      if (active < max) {
        active += 1;
        return;
      }
      await new Promise<void>((resolve) => {
        waiters.push(() => {
          active += 1;
          resolve();
        });
      });
    },
    release() {
      active = Math.max(0, active - 1);
      const next = waiters.shift();
      if (next) next();
    },
  };
}

/** Giữ 1 slot hàng đợi trong suốt lúc gọi API + chờ job xong, rồi nhả cho task kế. */
export async function withFrontendJobSlot<T>(
  queue: FrontendJobQueue,
  fn: () => Promise<T>,
  isCancelled?: () => boolean
): Promise<T> {
  await queue.acquire();
  try {
    if (isCancelled?.()) {
      throw new MediaGenerationJobError("Đã dừng", "JOB_CANCELLED");
    }
    return await fn();
  } finally {
    queue.release();
  }
}
