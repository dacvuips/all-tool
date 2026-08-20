/**
 * Worker pool cho batch tạo ảnh/video — giới hạn concurrency + chờ slot (không spam 429).
 */
import {
  createFrontendJobQueue,
  isStreamLimitEnqueueError,
  withFrontendJobSlot,
} from "../../../../lib/media/enqueue-stream-backoff";

export type BoundedBatchProgress = {
  setTotal: (n: number) => void;
  setCompleted: (n: number) => void;
  setErrors: (n: number) => void;
  setSkipped: (n: number) => void;
  setCurrentLabel?: (label: string) => void;
};

export type BoundedBatchItemResult = "done" | "skip" | "error";

/**
 * Chạy batch với tối đa `concurrency` job song song.
 * Mỗi task giữ 1 slot cho đến khi hoàn thành (enqueue + chờ job xong).
 * Lỗi 429 do hook/API retry xử lý — task không bị skip sớm.
 * `execute` có thể trả `'skip' | 'error'` cho lỗi mềm (không throw).
 */
export async function runBoundedMediaBatch<T>(options: {
  items: T[];
  concurrency: number;
  stopRef: { current: boolean };
  progress: BoundedBatchProgress;
  getLabel?: (item: T, index: number) => string;
  shouldSkip?: (item: T, index: number) => Promise<boolean>;
  execute: (item: T, index: number) => Promise<void | BoundedBatchItemResult>;
}): Promise<{ completed: number; errors: number; skipped: number; stopped: boolean }> {
  const { items, concurrency, stopRef, progress, getLabel, shouldSkip, execute } = options;
  const queue = createFrontendJobQueue(concurrency);

  progress.setTotal(items.length);
  progress.setCompleted(0);
  progress.setErrors(0);
  progress.setSkipped(0);
  progress.setCurrentLabel?.("");

  let completed = 0;
  let errors = 0;
  let skipped = 0;
  let nextIndex = 0;

  const bumpCompleted = () => {
    completed++;
    progress.setCompleted(completed);
  };

  const worker = async () => {
    while (true) {
      if (stopRef.current) return;

      const idx = nextIndex++;
      if (idx >= items.length) return;

      const item = items[idx];
      progress.setCurrentLabel?.(getLabel?.(item, idx) ?? String(idx + 1));

      if (shouldSkip) {
        try {
          if (await shouldSkip(item, idx)) {
            skipped++;
            progress.setSkipped(skipped);
            bumpCompleted();
            continue;
          }
        } catch {
          errors++;
          progress.setErrors(errors);
          bumpCompleted();
          continue;
        }
      }

      try {
        const outcome = await withFrontendJobSlot(
          queue,
          async () => execute(item, idx),
          () => stopRef.current
        );
        if (outcome === "skip") {
          skipped++;
          progress.setSkipped(skipped);
        } else if (outcome === "error") {
          errors++;
          progress.setErrors(errors);
        }
        bumpCompleted();
      } catch (err) {
        if (isStreamLimitEnqueueError(err)) {
          // Hook/API đã retry — nếu vẫn fail thì coi là lỗi, không spam item kế
          errors++;
          progress.setErrors(errors);
          bumpCompleted();
          continue;
        }
        errors++;
        progress.setErrors(errors);
        bumpCompleted();
      }
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, items.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { completed, errors, skipped, stopped: stopRef.current };
}
