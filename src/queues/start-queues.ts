/**
 * Khởi động các queue worker khi server start.
 * Gọi defaultQueue() để đăng ký processor cho từng queue.
 */

import { aiGenerationQueue } from "./ai-generation.queue";
import { mediaGenerationQueue, resumeStaleMediaJobs } from "./media-generation";
import logger from "../helpers/logger";

export function startQueues(): void {
  try {
    aiGenerationQueue.defaultQueue();
    logger.info("AiGenerationRun queue worker started");
  } catch (err: any) {
    logger.error("Failed to start AiGenerationRun queue", err);
  }
  try {
    mediaGenerationQueue.defaultQueue();
    logger.info("MediaGenerationJob queue worker started");
    // Re-enqueue các job stale (PROCESSING/QUEUED) sau khi server vừa restart.
    // Delay 2s để worker process kịp register trước khi nhận lại job cũ.
    setTimeout(() => {
      resumeStaleMediaJobs().catch((err) =>
        logger.error("[MediaGenerationJob] resume stale lỗi", err)
      );
    }, 2000);
  } catch (err: any) {
    logger.error("Failed to start MediaGenerationJob queue", err);
  }
}
