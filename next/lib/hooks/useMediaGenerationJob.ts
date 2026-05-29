/**
 * Hook dùng chung cho mọi luồng tạo media (ảnh/video) qua backend Job mới.
 *
 *   1. `POST` API enqueue → backend trả `{ jobId }`.
 *   2. Mở GraphQL subscription `mediaGenerationJobChanged(jobId)` (push realtime).
 *   3. **Đồng thời** query một lần `mediaGenerationJob(id)` để xử lý race condition
 *      (job có thể chạy xong trước khi subscription kết nối).
 *   4. Fallback poll mỗi vài giây nếu socket im lặng quá lâu.
 *   5. Heartbeat `touchWatch` mỗi 20s — gia hạn job watcher trên server (job video dài).
 *   6. Resolve khi nhận event `SUCCEEDED`; reject khi `FAILED` / `CANCELLED`.
 *
 * Edge cases đã xử lý:
 *   - Component unmount giữa chừng — cleanup mọi subscription/timer/promise (không leak).
 *   - Mất kết nối WS — apollo tự reconnect; trong khi đó poll fallback đảm bảo không kẹt.
 *   - Job xong trước khi subscribe — query initial sẽ phát hiện và resolve.
 *   - User huỷ — gọi `cancel(jobId)` → reject Promise + worker dừng emit.
 *   - Server restart — bee-queue stalled detector + worker idempotent; client chỉ cần đợi.
 *
 * Cách dùng tối thiểu:
 *
 *   const { run, cancel } = useMediaGenerationJob<{ images: ImageData[] }>();
 *
 *   const result = await run({
 *     url: "/api/app/generation-element-image/",
 *     body: { prompt, images, aspectRatio, ... },
 *     onProgress: (pct, msg) => setProgress(pct),
 *   });
 *   // result.data = { images: [...] }
 *   // result.jobId = "..."
 */
import { useCallback, useEffect, useRef } from "react";
import {
  MediaGenerationJob,
  MediaGenerationJobService,
} from "../repo/media-generation-job/media-generation-job.repo";

/** Kết quả trả về khi `run` thành công */
export type MediaGenerationRunResult<T> = {
  jobId: string;
  /** Dữ liệu cuối cùng do worker tạo ra — kiểu phụ thuộc handler (ảnh hoặc video) */
  data: T;
};

/** Tham số khi gọi `run()` */
export type MediaGenerationRunOptions<TBody = any> = {
  /** REST URL POST để enqueue (vd `/api/app/generation-element-image/`) */
  url: string;
  /** Body POST — backend sẽ lưu thành `requestPayload` */
  body: TBody;
  /** Headers tuỳ chỉnh (nếu cần) */
  headers?: Record<string, string>;
  /** Callback tiến độ (0–100). Hook tự đảm bảo không "lùi" progress. */
  onProgress?: (progress: number, message?: string) => void;
  /** Callback text message riêng (nếu UI muốn tách progress vs message) */
  onStatusMessage?: (message: string) => void;
  /**
   * Khoảng poll fallback (ms). Mặc định 8000ms.
   * Đặt 0 để tắt fallback (chỉ dựa subscription).
   */
  pollIntervalMs?: number;
  /**
   * Nếu component unmount khi job đang chạy, có gọi cancel không?
   * Mặc định `false` — worker chạy tiếp; job SUCCEEDED sẽ bị xóa khỏi Mongo sau khi publish socket.
   */
  cancelOnUnmount?: boolean;
};

/** Lỗi do `run()` ném ra — có `code` để client phân biệt (cancel vs network vs server) */
export class MediaGenerationJobError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "ENQUEUE_FAILED"
      | "JOB_FAILED"
      | "JOB_CANCELLED"
      | "JOB_NOT_FOUND"
      | "JOB_TIMEOUT"
      | "UNKNOWN",
    public readonly jobId?: string,
    public readonly httpStatus?: number
  ) {
    super(message);
    this.name = "MediaGenerationJobError";
  }
}

const DEFAULT_POLL_INTERVAL = 8000;
/** Gia hạn Redis job watcher (TTL server ~45s) */
const WATCH_HEARTBEAT_MS = 20_000;
/** Số lần poll liên tiếp không thấy job trên server → dừng theo dõi */
const JOB_MISSING_POLL_THRESHOLD = 2;

export function useMediaGenerationJob<TResult = unknown, TBody = any>() {
  /** Theo dõi mọi "instance" run() đang sống để cleanup khi unmount */
  const activeHandlesRef = useRef<Array<{ jobId: string | null; cleanup: () => void; cancelOnUnmount?: boolean }>>([]);

  /** Cleanup mọi handle khi component unmount */
  useEffect(() => {
    return () => {
      for (const h of activeHandlesRef.current) {
        if (h.cancelOnUnmount && h.jobId) {
          // Best-effort: gọi cancel API nhưng không chờ
          MediaGenerationJobService.cancelJob(h.jobId).catch(() => undefined);
        }
        h.cleanup();
      }
      activeHandlesRef.current = [];
    };
  }, []);

  /** Helper: an toàn gọi onProgress chỉ khi progress mới >= progress trước */
  const buildProgressGuard = useCallback(
    (onProgress?: (p: number, msg?: string) => void, onMsg?: (m: string) => void) => {
      let lastProgress = -1;
      return (job: MediaGenerationJob | null) => {
        if (!job) return;
        if (typeof job.progress === "number" && job.progress >= lastProgress) {
          lastProgress = job.progress;
          if (onProgress) onProgress(job.progress, job.message ?? undefined);
        }
        if (job.message && onMsg) onMsg(job.message);
      };
    },
    []
  );

  /** POST enqueue + theo dõi đến khi terminal. */
  const run = useCallback(
    async (opts: MediaGenerationRunOptions<TBody>): Promise<MediaGenerationRunResult<TResult>> => {
      const pollIntervalMs = opts.pollIntervalMs ?? DEFAULT_POLL_INTERVAL;
      const handle: { jobId: string | null; cleanup: () => void; cancelOnUnmount?: boolean } = {
        jobId: null,
        cleanup: () => undefined,
        cancelOnUnmount: opts.cancelOnUnmount,
      };
      activeHandlesRef.current.push(handle);

      // ── 1. Enqueue qua REST ────────────────────────────────────────────────
      let jobId: string;
      try {
        const res = await fetch(opts.url, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
          body: JSON.stringify(opts.body),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new MediaGenerationJobError(
            (err as any)?.message || `Lỗi ${res.status}`,
            "ENQUEUE_FAILED",
            undefined,
            res.status
          );
        }
        const data = await res.json();
        if (!data?.jobId) {
          throw new MediaGenerationJobError(
            "Backend không trả về jobId",
            "ENQUEUE_FAILED",
            undefined,
            res.status
          );
        }
        jobId = String(data.jobId);
        handle.jobId = jobId;
      } catch (err: any) {
        const idx = activeHandlesRef.current.indexOf(handle);
        if (idx >= 0) activeHandlesRef.current.splice(idx, 1);
        if (err instanceof MediaGenerationJobError) throw err;
        throw new MediaGenerationJobError(
          err?.message || "Lỗi khi tạo job",
          "ENQUEUE_FAILED"
        );
      }

      // ── 2. Theo dõi job qua subscription + poll fallback ──────────────────
      const updateGuard = buildProgressGuard(opts.onProgress, opts.onStatusMessage);

      return new Promise<MediaGenerationRunResult<TResult>>((resolve, reject) => {
        let settled = false;
        let missingPollCount = 0;
        let subscription: { unsubscribe: () => void } | null = null;
        let pollTimer: ReturnType<typeof setInterval> | null = null;
        let watchHeartbeatTimer: ReturnType<typeof setInterval> | null = null;

        /** Dọn dẹp mọi resource — gọi 1 lần */
        const cleanup = () => {
          if (subscription) {
            try {
              subscription.unsubscribe();
            } catch {
              /* ignore */
            }
            subscription = null;
          }
          if (pollTimer) {
            clearInterval(pollTimer);
            pollTimer = null;
          }
          if (watchHeartbeatTimer) {
            clearInterval(watchHeartbeatTimer);
            watchHeartbeatTimer = null;
          }
          const idx = activeHandlesRef.current.indexOf(handle);
          if (idx >= 0) activeHandlesRef.current.splice(idx, 1);
        };
        handle.cleanup = cleanup;

        /** Job đã bị xóa khỏi Mongo (abandon / cleanup) — dừng poll vô hạn */
        const handleMissingJob = () => {
          if (settled) return;
          missingPollCount += 1;
          if (missingPollCount < JOB_MISSING_POLL_THRESHOLD) return;
          settled = true;
          cleanup();
          reject(
            new MediaGenerationJobError(
              "Job không còn trên server (có thể đã huỷ hoặc mất kết nối theo dõi)",
              "JOB_NOT_FOUND",
              jobId
            )
          );
        };

        /** Nhận snapshot từ query / poll / subscription */
        const handleJobSnapshot = (job: MediaGenerationJob | null) => {
          if (settled) return;
          if (!job) {
            handleMissingJob();
            return;
          }
          missingPollCount = 0;
          processJob(job);
        };

        /** Xử lý 1 snapshot job — quyết định resolve/reject hay tiếp tục */
        const processJob = (job: MediaGenerationJob | null) => {
          if (settled || !job) return;
          updateGuard(job);

          switch (job.status) {
            case "SUCCEEDED": {
              settled = true;
              cleanup();
              resolve({ jobId: job.id, data: (job.resultData as TResult) ?? (null as any) });
              break;
            }
            case "FAILED": {
              settled = true;
              cleanup();
              reject(
                new MediaGenerationJobError(
                  job.errorMessage || "Tạo media thất bại",
                  "JOB_FAILED",
                  job.id,
                  job.errorCode ?? undefined
                )
              );
              break;
            }
            case "CANCELLED": {
              settled = true;
              cleanup();
              reject(new MediaGenerationJobError("Đã huỷ", "JOB_CANCELLED", job.id));
              break;
            }
            // QUEUED / PROCESSING — tiếp tục theo dõi
            default:
              break;
          }
        };

        // Đăng ký watcher sớm (subscription server cũng set; touch là fallback poll / WS chậm)
        MediaGenerationJobService.touchWatch(jobId).catch(() => undefined);

        // 2a. Subscribe realtime
        try {
          const obs = MediaGenerationJobService.subscribeJobChanged<TResult>(jobId);
          subscription = obs.subscribe({
            next: (job) => handleJobSnapshot(job),
            error: (err: any) => {
              // Lỗi subscription (WS disconnect, ...) — không reject; poll sẽ kéo tiếp
              console.warn("[useMediaGenerationJob] subscription error:", err?.message);
            },
          });
        } catch (err: any) {
          console.warn("[useMediaGenerationJob] không subscribe được:", err?.message);
        }

        // 2b. Query initial — xử lý race "job xong trước khi subscribe"
        MediaGenerationJobService.getJob<TResult>(jobId)
          .then((job) => handleJobSnapshot(job))
          .catch((err) => {
            console.warn("[useMediaGenerationJob] query initial lỗi:", err?.message);
            handleMissingJob();
          });

        // 2c. Poll fallback (nếu enable)
        if (pollIntervalMs > 0) {
          pollTimer = setInterval(() => {
            if (settled) return;
            MediaGenerationJobService.getJob<TResult>(jobId)
              .then((job) => handleJobSnapshot(job))
              .catch(() => handleMissingJob());
          }, pollIntervalMs);
        }

        // 2d. Heartbeat job watcher — server chỉ chạy job khi client còn theo dõi
        watchHeartbeatTimer = setInterval(() => {
          if (settled) return;
          MediaGenerationJobService.touchWatch(jobId).catch(() => undefined);
        }, WATCH_HEARTBEAT_MS);
      });
    },
    [buildProgressGuard]
  );

  /** Huỷ job đang chạy (gọi mutation; worker tự dừng emit ở milestone tiếp theo). */
  const cancel = useCallback(async (jobId: string): Promise<void> => {
    try {
      await MediaGenerationJobService.cancelJob(jobId);
    } catch (err: any) {
      console.warn("[useMediaGenerationJob] cancel lỗi:", err?.message);
    }
  }, []);

  /** Retry job FAILED — backend reset state + enqueue lại. */
  const retry = useCallback(async (jobId: string): Promise<void> => {
    try {
      await MediaGenerationJobService.retryJob(jobId);
    } catch (err: any) {
      console.warn("[useMediaGenerationJob] retry lỗi:", err?.message);
    }
  }, []);

  return { run, cancel, retry };
}
