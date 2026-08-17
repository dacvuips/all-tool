import Queue, { Job, QueueSettings } from "bee-queue";
import config from "config";
import { EventEmitter } from "events";
import { Dictionary } from "lodash";
import { SafeRedisLeader } from "ts-safe-redis-leader";
import { Logger } from "winston";

import redis from "../helpers/redis";
import logger from "../helpers/logger";
import { SharedRedisClient } from "../helpers/sharedRedisClient";
import { IS_DEBUG } from "../libs/shared";

type QueueOptions = QueueSettings & {
  uniqueWorker?: boolean;
  defaultQueues?: string[];
  /** Thời gian (ms) job ở trạng thái active trước khi coi là stalled và đưa lại vào queue. Mặc định 60s; với job lâu (AI ảnh/video) nên đặt 10–15 phút. */
  stallIntervalMs?: number;
  /**
   * Thời gian (ms) tối đa job được giữ trong Redis (mọi trạng thái: failed, succeeded, waiting, delayed, active), sau đó cleanup.
   * Bee-queue không có TTL sẵn → dùng cleanup định kỳ. Ví dụ 72h = 72*60*60*1000.
   */
  jobRetentionMs?: number;
};

/** 24 giờ (ms) – cleanup chạy đúng 1 lần mỗi ngày vào 00:00 */
const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export abstract class BaseQueue extends EventEmitter {
  private _queues: Dictionary<Queue> = {};
  protected logger: Logger = logger.child({ _reqId: `${this.name}` });
  private _leaders: Dictionary<SafeRedisLeader> = {};
  private _retentionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private _retentionIntervalId: ReturnType<typeof setInterval> | null = null;

  constructor(
    public name: string,
    public concurrency: number = 1,
    public options: QueueOptions = {}
  ) {
    super();
  }

  private handleLeaderEvent(leader: any, id: string) {
    leader.on("elected", () => {
      this.logger.info("Worker Leader elected");
      this.applyProcessToQueue(id);
    });
    leader.on("demoted", () => {
      this.logger.info("Worker Leader demoted");
      this.removeProcessToQueue(id);
    });
  }

  defaultQueue() {
    if (this.options.defaultQueues && this.options.defaultQueues.length > 0) {
      for (const id of this.options.defaultQueues) {
        this.queue(id);
      }
    }
    return this.queue();
  }

  /** Lấy instance queue chỉ khi đã được khởi tạo (không tạo mới). Dùng để kiểm tra trạng thái. */
  getQueueIfExists(id?: string): Queue | undefined {
    if (!id) {
      id = IS_DEBUG ? "dev" : "prod";
    }
    return this._queues[id];
  }

  /**
   * Flag: queue id đã gọi Queue#process. Bee-queue chỉ cho process 1 lần / instance.
   */
  private _processApplied: Record<string, boolean> = {};
  /** Debounce recreate worker sau Redis abort (tránh loop). */
  private _restartAfterRedisErrorAt: Record<string, number> = {};
  /** Hẹn recreate sau khi job in-memory kết thúc. */
  private _recreateScheduled: Record<string, ReturnType<typeof setTimeout> | null> = {};

  private resolveQueueId(id?: string): string {
    return id || (IS_DEBUG ? "dev" : "prod");
  }

  /** Số job handler đang chạy trong process hiện tại (bee-queue `running`). */
  getInMemoryRunningCount(id?: string): number {
    const queueId = this.resolveQueueId(id);
    const q = this.getQueueIfExists(queueId);
    if (!q) return 0;
    const running = (q as any).running;
    return typeof running === "number" && running > 0 ? running : 0;
  }

  private isQueueFinishAfterCloseError(err: any): boolean {
    const msg = String(err?.message || "");
    return /unable to update the status of (succeeded|failed) job/i.test(msg);
  }

  /** Giữ listener trên queue cũ để tránh Unhandled 'error' khi job hoàn tất sau close(). */
  private attachBenignCloseErrorGuard(queue: Queue, id: string): void {
    queue.on("error", (err: Error) => {
      if (this.isQueueFinishAfterCloseError(err)) {
        this.logger.warn(
          `[${this.name}:${id}] Job finished after queue close (benign): ${err.message}`
        );
        return;
      }
      this.logger.warn(`[${this.name}:${id}] Detached queue error: ${err.message}`);
    });
  }

  private detachQueueForRecreate(existing: Queue, id: string): void {
    try {
      this.attachBenignCloseErrorGuard(existing, id);
      const maybePromise = (existing as any).close(5000);
      if (maybePromise && typeof maybePromise.then === "function") {
        maybePromise.catch((err: any) => {
          this.logger.warn(
            `[${this.name}:${id}] close queue before recreate: ${err?.message || err}`
          );
        });
      }
    } catch (err: any) {
      this.logger.warn(
        `[${this.name}:${id}] close queue before recreate: ${err?.message || err}`
      );
    }
  }

  private scheduleRecreateWhenIdle(id: string): void {
    if (this._recreateScheduled[id]) return;

    const tick = () => {
      if (this.getInMemoryRunningCount(id) > 0) {
        this._recreateScheduled[id] = setTimeout(tick, 3000);
        return;
      }
      this._recreateScheduled[id] = null;
      if (this.recreateWorker(id)) {
        this.logger.warn(`[${this.name}:${id}] Consumer recreated after in-memory jobs finished`);
      }
    };

    this._recreateScheduled[id] = setTimeout(tick, 3000);
  }

  /**
   * Tạo lại worker bee-queue (instance mới + process 1 lần).
   *
   * **Không** dùng `Queue#destroy()` (xoá job trong Redis) + `process` lại trên cùng instance
   * → bee-queue ném `Cannot call Queue#process twice`, consumer chết, job kẹt waiting/0%.
   *
   * @returns true nếu consumer mới đã được tạo ngay; false nếu hoãn vì còn job in-memory.
   */
  private recreateWorker(id: string): boolean {
    const existing = this._queues[id];
    if (existing) {
      const running = this.getInMemoryRunningCount(id);
      if (running > 0) {
        this.logger.warn(
          `[${this.name}:${id}] Defer consumer recreate — ${running} job(s) still running in memory`
        );
        this.scheduleRecreateWhenIdle(id);
        return false;
      }
      this.detachQueueForRecreate(existing, id);
      delete this._queues[id];
      this._processApplied[id] = false;
    }
    this.queue(id);
    return true;
  }

  /**
   * Khởi động lại bee-queue consumer khi job kẹt ở `waiting` (Redis ECONNRESET / worker im lặng).
   * Idempotent — gọi nhiều lần an toàn.
   */
  restartQueueConsumer(id?: string): void {
    id = this.resolveQueueId(id);
    try {
      if (!this.getQueueIfExists(id)) {
        this.queue(id);
        this.logger.warn(`[${this.name}:${id}] Consumer started (queue was missing)`);
        return;
      }
      if (this.recreateWorker(id)) {
        this.logger.warn(`[${this.name}:${id}] Consumer restarted`);
      }
    } catch (err) {
      this.logger.error(`[${this.name}:${id}] restartQueueConsumer lỗi`, err);
    }
  }

  /** Trạng thái queue: running = worker đã start và queue phản hồi, active/waiting từ Redis. */
  async getQueueStatus(
    id?: string
  ): Promise<{ running: boolean; active: number; waiting: number; newestJob?: string }> {
    const q = this.getQueueIfExists(id);
    if (!q) {
      return { running: false, active: 0, waiting: 0 };
    }
    try {
      const health = await q.checkHealth();
      return { running: true, ...health };
    } catch {
      return { running: false, active: 0, waiting: 0 };
    }
  }

  /** Các trạng thái job trong bee-queue – cleanup tất cả job cũ hơn jobRetentionMs */
  private static JOB_TYPES_FOR_CLEANUP: Array<"failed" | "succeeded" | "waiting" | "delayed" | "active"> = [
    "failed",
    "succeeded",
    "waiting",
    "delayed",
    "active",
  ];

  /** Xóa mọi job (failed, succeeded, waiting, delayed, active) cũ hơn jobRetentionMs (chạy định kỳ) */
  private async cleanupOldJobs(): Promise<void> {
    const retentionMs = this.options.jobRetentionMs;
    if (!retentionMs || retentionMs <= 0) return;
    const cutoff = Date.now() - retentionMs;
    const retentionHours = retentionMs / 3600000;
    for (const id of Object.keys(this._queues)) {
      const q = this._queues[id];
      let totalRemoved = 0;
      try {
        for (const jobType of BaseQueue.JOB_TYPES_FOR_CLEANUP) {
          const jobs = await q.getJobs(jobType, { start: 0, size: 500 });
          for (const job of jobs) {
            const created = (job as any).createdAt;
            const ts = typeof created === "number" ? created : new Date(created).getTime();
            if (ts < cutoff) {
              await job.remove();
              totalRemoved++;
            }
          }
        }
        if (totalRemoved > 0) {
          this.logger.info(
            `[${this.name}:${id}] Cleanup: removed ${totalRemoved} job(s) older than ${retentionHours}h`
          );
        }
      } catch (err) {
        this.logger.error(`[${this.name}:${id}] Cleanup old jobs error`, err);
      }
    }
  }

  queue(id?: string) {
    if (!id) {
      id = IS_DEBUG ? "dev" : "prod";
    }
    if (!this._queues[id]) {
      const { uniqueWorker, ...queueOptions } = this.options;
      this._queues[id] = new Queue(this.name, {
        prefix: id,
        removeOnSuccess: true,
        removeOnFailure: true,
        redis: SharedRedisClient.instance.client,
        isWorker: true,
        ...queueOptions,
      });
      this.bindQueueErrorHandler(id);

      if (true) {
        if (uniqueWorker) {
          if (!this._leaders[id]) {
            this._leaders[id] = new SafeRedisLeader(redis, 30000, 40000, this.name);
            this.handleLeaderEvent(this._leaders[id], id);
            this._leaders[id].elect();
          }
        } else {
          this.applyProcessToQueue(id);
        }
      }

      if (this.options.jobRetentionMs && !this._retentionIntervalId && !this._retentionTimeoutId) {
        this.scheduleRetentionCleanup();
      }
    }
    return this._queues[id];
  }

  /** Lên lịch cleanup đúng 00:00 hằng ngày (chạy 1 lần/ngày) */
  private scheduleRetentionCleanup(): void {
    const runAtNextMidnight = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(0, 0, 0, 0);
      if (next.getTime() <= now.getTime()) {
        next.setDate(next.getDate() + 1);
      }
      const delayMs = next.getTime() - Date.now();
      this.logger.info(
        `[${this.name}] Job retention cleanup will run at ${next.toISOString()} (in ${Math.round(delayMs / 60000)} min)`
      );
      this._retentionTimeoutId = setTimeout(() => {
        this._retentionTimeoutId = null;
        this.cleanupOldJobs();
        this._retentionIntervalId = setInterval(() => {
          this.cleanupOldJobs();
        }, ONE_DAY_MS);
      }, delayMs);
    };
    runAtNextMidnight();
  }

  private applyProcessToQueue(id: string) {
    try {
      if (this._processApplied[id] && this._queues[id]) {
        this.logger.warn(
          `[${this.name}:${id}] process already applied — skip (use recreateWorker to rebind)`
        );
        return;
      }
      this._queues[id].process(this.concurrency, (job) => {
        return this.process(job).catch((err) => {
          this.logger.error("Error when process job", err);
          throw err;
        });
      });
      this._processApplied[id] = true;
      // Check Stalled Job
      this.checkStalledJob(id);
    } catch (err) {
      this.logger.error("Error when apply process to queue", err);
      this._processApplied[id] = false;
    }
  }

  private removeProcessToQueue(id: string) {
    try {
      this._queues[id].close();
      this._queues[id].removeAllListeners();

      // init new queue without process
      const { uniqueWorker, ...queueOptions } = this.options;
      this._queues[id] = new Queue(this.name, {
        prefix: id,
        removeOnSuccess: true,
        removeOnFailure: true,
        redis: SharedRedisClient.instance.client,
        isWorker: true,
        ...queueOptions,
      });
      this.bindQueueErrorHandler(id);
    } catch (err) {
      this.logger.error("Error when remove process to queue", err);
    }
  }

  private checkStalledJob(id: string) {
    if (this._queues[id]) {
      const stallIntervalMs = this.options.stallIntervalMs ?? 60000;
      this._queues[id].checkStalledJobs(stallIntervalMs, (err, stalled) => {
        if (err) {
          this.logger.error("Error when check stalled job", err);
        }
        if (stalled > 0) {
          this.logger.info(`Check Stalled Job (${stalled})`);
        }
        this._queues[id]
          .checkHealth()
          .then(async ({ active, waiting, newestJob }) => {
            if (active > 0) {
              if (waiting == 0) {
                const jobs = await this._queues[id].getJobs("active", { start: 0, size: 1 });
                if (jobs.length == 0) {
                  // Health báo active nhưng không có job thật → recreate worker
                  this.logger.warn(
                    `[${this.name}:${id}] Phantom active count — recreate queue worker`
                  );
                  this.recreateWorker(id);
                }
              }
              this.logger.info(`Processing [${active}/${waiting}]`);
            }
          })
          .catch((err) => {
            this.logger.error("Error when check queue status", err);
          });
      });
    }
  }
  protected abstract process(job: Job<any>): Promise<any>;

  private bindQueueErrorHandler(id: string) {
    const q = this._queues[id];
    if (!q) return;
    q.on("error", (err: Error) => this.handleQueueError(id, err));
  }

  private isRedisAbortError(err: any): boolean {
    const code = String(err?.code || "");
    const msg = String(err?.message || "");
    return (
      code === "UNCERTAIN_STATE" ||
      code === "NR_CLOSED" ||
      /connection lost/i.test(msg) ||
      /ECONNRESET|ECONNREFUSED|ETIMEDOUT/i.test(msg)
    );
  }

  private handleQueueError(id: string, err: Error) {
    if (this.isQueueFinishAfterCloseError(err)) {
      this.logger.warn(
        `[${this.name}:${id}] Job finished after queue close (benign): ${err.message}`
      );
      return;
    }
    if (this.isRedisAbortError(err)) {
      this.logger.warn(
        `[${this.name}:${id}] Redis abort (BRPOPLPUSH) — ${err.message}`
      );
      const now = Date.now();
      const last = this._restartAfterRedisErrorAt[id] || 0;
      if (now - last < 4000) return;
      this._restartAfterRedisErrorAt[id] = now;
      setTimeout(() => {
        try {
          this.restartQueueConsumer(id);
        } catch (restartErr: any) {
          this.logger.error(
            `[${this.name}:${id}] restart after Redis abort failed: ${
              restartErr?.message || restartErr
            }`
          );
        }
      }, 1500);
      return;
    }
    this.logger.error(`[${this.name}:${id}] Queue error: ${err.message}`, err);
  }
}
