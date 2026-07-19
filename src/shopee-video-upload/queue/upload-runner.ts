/**
 * Worker poll job queued → gọi uploadOneVideo.
 * Chạy in-process (không bee-queue) để module độc lập.
 */
import logger from "../../helpers/logger";
import { uploadOneVideo } from "../pipeline/upload-one-video";
import {
  getUploadJob,
  listQueuedJobs,
  updateUploadJob,
} from "./upload-job.store";
import { ShopeeUploadJobStatus } from "./upload-job.types";

const CONCURRENCY = Math.max(1, Number(process.env.SHOPEE_UPLOAD_CONCURRENCY) || 2);
let running = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const inflight = new Set<string>();

async function processOne(jobId: string): Promise<void> {
  if (inflight.has(jobId)) return;
  const job = getUploadJob(jobId);
  if (!job || job.status !== ShopeeUploadJobStatus.QUEUED) return;

  inflight.add(jobId);
  running += 1;
  updateUploadJob(jobId, { status: ShopeeUploadJobStatus.RUNNING, error: undefined });

  try {
    const result = await uploadOneVideo(job.payload);
    if (result.success) {
      updateUploadJob(jobId, {
        status: ShopeeUploadJobStatus.SUCCEEDED,
        result: {
          postId: result.postId,
          postLink: result.postLink,
          dryRun: result.dryRun,
        },
      });
    } else {
      updateUploadJob(jobId, {
        status: ShopeeUploadJobStatus.FAILED,
        error: result.error || "Upload failed",
      });
    }
  } catch (err: any) {
    updateUploadJob(jobId, {
      status: ShopeeUploadJobStatus.FAILED,
      error: err?.message || String(err),
    });
  } finally {
    inflight.delete(jobId);
    running -= 1;
  }
}

async function tick(): Promise<void> {
  if (running >= CONCURRENCY) return;
  const queued = listQueuedJobs().sort((a, b) => a.createdAt - b.createdAt);
  const slots = CONCURRENCY - running;
  const batch = queued.slice(0, slots);
  await Promise.all(batch.map((j) => processOne(j.id)));
}

/** Khởi động poller (idempotent) */
export function startUploadRunner(): void {
  if (timer) return;
  timer = setInterval(() => {
    void tick().catch((err) =>
      logger.warn(`[shopee-upload-runner] tick: ${err?.message || err}`)
    );
  }, 1000);
  logger.info(`[shopee-upload-runner] started concurrency=${CONCURRENCY}`);
}

export function stopUploadRunner(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

// Auto-start khi module được require lần đầu (route load)
startUploadRunner();
