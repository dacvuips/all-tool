/**
 * Khởi động các queue worker khi server start.
 * Gọi defaultQueue() để đăng ký processor cho từng queue.
 */

import { aiGenerationQueue } from "./ai-generation.queue";
import logger from "../helpers/logger";

export function startQueues(): void {
  try {
    aiGenerationQueue.defaultQueue();
    logger.info("AiGenerationRun queue worker started");
  } catch (err: any) {
    logger.error("Failed to start queues", err);
  }
}
