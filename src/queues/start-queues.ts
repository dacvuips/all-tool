/**
 * Khởi động các queue worker khi server start.
 * Gọi defaultQueue() để đăng ký processor cho từng queue.
 */

import { aiGenerationQueue } from "./ai-generation.queue";
import {
  mediaGenerationQueue,
  recoverStalledBeeJobsOnStartup,
  resumeStaleMediaJobs,
  startMediaJobCleanupSweep,
  startStaleProcessingRecoverySweep,
} from "./media-generation";
import logger from "../helpers/logger";
import { waitForMainConnection } from "../helpers/mongo";
import { SharedRedisClient } from "../helpers/sharedRedisClient";

export function startQueues(): void {
  void startQueuesAsync();
}

async function startQueuesAsync(): Promise<void> {
  try {
    await waitForMainConnection();
  } catch (err: any) {
    logger.error("Failed to wait for Mongo before starting queues", err);
    return;
  }

  try {
    await SharedRedisClient.instance.waitUntilReady(20000);
  } catch (err: any) {
    logger.warn(
      `[startQueues] Redis chưa ready — vẫn start worker, recovery sẽ retry: ${err?.message || err}`
    );
  }

  try {
    aiGenerationQueue.defaultQueue();
    logger.info("AiGenerationRun queue worker started");
  } catch (err: any) {
    logger.error("Failed to start AiGenerationRun queue", err);
  }

  try {
    mediaGenerationQueue.defaultQueue();
    logger.info("MediaGenerationJob queue worker started");
    startMediaJobCleanupSweep();
    startStaleProcessingRecoverySweep();
    // Worker đã process(); Redis đã ready — dọn bee-job mồ côi rồi re-enqueue Mongo.
    try {
      await recoverStalledBeeJobsOnStartup();
      await resumeStaleMediaJobs();
    } catch (err: any) {
      const msg = String(err?.message || err || "");
      if (/ready check failed|connection lost|Redis ready timeout/i.test(msg)) {
        logger.warn(`[MediaGenerationJob] Redis chưa sẵn sàng khi resume stale — sẽ sweep lại sau`);
        return;
      }
      logger.error("[MediaGenerationJob] resume stale lỗi", err);
    }
  } catch (err: any) {
    logger.error("Failed to start MediaGenerationJob queue", err);
  }
}
