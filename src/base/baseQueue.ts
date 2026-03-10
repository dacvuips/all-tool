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
      // // Add Queue to QueueManager
      // QueueManager.instance.addQueue(`${id}:${this.name}`, this._queues[id], {
      //   name: this.name,
      //   prefix: id,
      //   concurrency: this.concurrency,
      // });

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
      const { uniqueWorker, ...queueOptions } = this.options;
      this._queues[id].process(this.concurrency, (job) => {
        return this.process(job).catch((err) => {
          this.logger.error("Error when process job", err);
          throw err;
        });
      });
      // Check Stalled Job
      this.checkStalledJob(id);
    } catch (err) {
      this.logger.error("Error when apply process to queue", err);
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
      // QueueManager.instance.removeQueue(`${id}:${this.name}`);
      // QueueManager.instance.addQueue(`${id}:${this.name}`, this._queues[id], {
      //   name: this.name,
      //   prefix: id,
      //   concurrency: this.concurrency,
      // });
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
                  this.logger.info("detroy error queue");
                  this._queues[id].destroy();
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

  private handleQueueError(err: Error) {
    this.logger.error("Queue error::::" + err.message);
  }
}
