/**
 * ThreadRunner — scheduler concurrency + pause / resume cho luồng gen.
 *
 * Kiến trúc:
 * - Nhận callback `runJob(item)` từ caller (panel) — không biết logic gen bên trong.
 * - Ghi patch IDB (status running / error) qua `thread-store` để crash-safe.
 * - Callback nội bộ tự cập nhật state React + IDB khi hoàn tất (thông qua UI logic hiện có).
 *
 * Cho phép nâng cấp về sau: worker / IDB-only pipeline mà không đổi API caller.
 */

import { patchThread, subscribeThreadEvents, ThreadEvent } from "./thread-store";
import { AffiliatePlusItem } from "./types";

export type RunJobResult = "success" | "error" | "cancelled";

export type RunJobFn = (item: AffiliatePlusItem, ctx: RunCtx) => Promise<RunJobResult | void>;

export type RunCtx = {
  /** Trả về true khi user đã bấm pause — callback nên bail sớm. */
  isPaused: () => boolean;
  sessionId: string;
};

export type RunnerEvent =
  | { type: "started"; total: number }
  | { type: "item-start"; id: string }
  | { type: "item-done"; id: string; result: RunJobResult }
  | { type: "paused" }
  | { type: "finished"; success: number; error: number; cancelled: number };

export interface RunnerOptions {
  sessionId: string;
  concurrency: number;
  runJob: RunJobFn;
  onEvent?: (ev: RunnerEvent) => void;
  /** Nếu true — sẽ set status = 'running' trong IDB trước khi gọi runJob. */
  autoPatchStatus?: boolean;
}

/** Chạy queue items với concurrency limit + hỗ trợ pause. */
export class ThreadRunner {
  private paused = false;
  private stopped = false;
  private inflight = new Set<string>();
  private queue: AffiliatePlusItem[] = [];
  private opts: RunnerOptions;
  private resultCounts = { success: 0, error: 0, cancelled: 0 };

  constructor(opts: RunnerOptions) {
    this.opts = opts;
  }

  isPaused(): boolean {
    return this.paused || this.stopped;
  }

  pause(): void {
    this.paused = true;
    this.opts.onEvent?.({ type: "paused" });
  }

  resume(): void {
    if (this.stopped) return;
    this.paused = false;
  }

  stop(): void {
    this.stopped = true;
    this.paused = true;
  }

  async run(items: AffiliatePlusItem[]): Promise<{
    success: number;
    error: number;
    cancelled: number;
  }> {
    this.queue = items.slice();
    this.resultCounts = { success: 0, error: 0, cancelled: 0 };
    this.opts.onEvent?.({ type: "started", total: this.queue.length });

    const concurrency = Math.max(
      1,
      Math.min(50, Math.round(this.opts.concurrency || 1))
    );
    let cursor = 0;

    const runOne = async (item: AffiliatePlusItem) => {
      if (this.isPaused()) {
        this.resultCounts.cancelled += 1;
        this.opts.onEvent?.({ type: "item-done", id: item.id, result: "cancelled" });
        return;
      }

      this.inflight.add(item.id);
      this.opts.onEvent?.({ type: "item-start", id: item.id });

      if (this.opts.autoPatchStatus) {
        try {
          await patchThread(this.opts.sessionId, item.id, {
            status: "running",
            error: "",
          });
        } catch {
          // ignore
        }
      }

      let result: RunJobResult = "success";
      try {
        const ret = await this.opts.runJob(item, {
          isPaused: () => this.isPaused(),
          sessionId: this.opts.sessionId,
        });
        if (ret === "error") result = "error";
        else if (ret === "cancelled" || this.isPaused()) result = "cancelled";
      } catch (err: any) {
        result = "error";
        if (this.opts.autoPatchStatus) {
          try {
            await patchThread(this.opts.sessionId, item.id, {
              status: "error",
              error: String(err?.message || err || "runJob failed"),
            });
          } catch {
            // ignore
          }
        }
      } finally {
        this.inflight.delete(item.id);
      }

      this.resultCounts[result] += 1;
      this.opts.onEvent?.({ type: "item-done", id: item.id, result });
    };

    const worker = async () => {
      while (true) {
        if (this.isPaused()) return;
        const idx = cursor++;
        if (idx >= this.queue.length) return;
        await runOne(this.queue[idx]);
      }
    };

    const workers = Array.from({ length: concurrency }, () => worker());
    await Promise.all(workers);

    this.opts.onEvent?.({
      type: "finished",
      success: this.resultCounts.success,
      error: this.resultCounts.error,
      cancelled: this.resultCounts.cancelled,
    });

    return { ...this.resultCounts };
  }
}

/** Tiện: subscribe patch từ thread-store để UI cập nhật riêng từng row. */
export function subscribeThreadPatches(
  fn: (ev: ThreadEvent) => void
): () => void {
  return subscribeThreadEvents(fn);
}
