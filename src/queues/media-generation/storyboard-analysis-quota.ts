/**
 * Hoàn trả 1 request slot đã reserve cho job STORYBOARD_ANALYSIS khi fail/cancel.
 * Dùng metadata trên Mongo (atomic) — không phụ thuộc Redis payload / object in-memory.
 */
import logger from "../../helpers/logger";
import {
  mediaGenerationJobService,
  MediaGenerationJobType,
} from "../../libs/dal/mediaGenerationJob";
import { releaseRequestSlots } from "../../routers/app/affiliate-scene/_shared";

export const STORYBOARD_QUOTA_RESERVED_META = "storyboardQuotaReserved";
export const STORYBOARD_QUOTA_RELEASED_META = "storyboardQuotaReleased";

export async function releaseStoryboardAnalysisQuotaIfNeeded(job: {
  _id?: unknown;
  id?: string;
  customerId?: string;
  type?: MediaGenerationJobType | string;
}): Promise<void> {
  if (job.type !== MediaGenerationJobType.STORYBOARD_ANALYSIS) return;

  const jobId = String(job._id || job.id || "");
  const customerId = String(job.customerId || "");
  if (!jobId || !customerId) return;

  const model = mediaGenerationJobService.model;
  // Claim quyền hoàn trả 1 lần — tránh double-release (cancel + handler catch)
  const claimed = await model.findOneAndUpdate(
    {
      _id: jobId,
      type: MediaGenerationJobType.STORYBOARD_ANALYSIS,
      [`metadata.${STORYBOARD_QUOTA_RESERVED_META}`]: true,
      [`metadata.${STORYBOARD_QUOTA_RELEASED_META}`]: { $ne: true },
    },
    {
      $set: {
        [`metadata.${STORYBOARD_QUOTA_RESERVED_META}`]: false,
        [`metadata.${STORYBOARD_QUOTA_RELEASED_META}`]: true,
      },
    },
    { new: true }
  );

  if (!claimed) return;

  try {
    await releaseRequestSlots(customerId, 1);
  } catch (err: any) {
    logger.error(
      `[storyboard-analysis] Hoàn trả quota thất bại jobId=${jobId}: ${err?.message}`
    );
  }
}
