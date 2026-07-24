/**
 * Giới hạn luồng đồng thời cho API Media — tách riêng khỏi luồng app (googlePackage).
 *
 * Đếm job `API_MEDIA_*` theo `metadata.apiMediaTokenId` và `token.streamCount`.
 */
import { ApiMediaTokenModel } from "../../libs/dal/apiMediaToken";
import {
  MediaGenerationJobModel,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../libs/dal/mediaGenerationJob";

export const API_MEDIA_JOB_TYPES: ReadonlyArray<MediaGenerationJobType> = [
  MediaGenerationJobType.API_MEDIA_IMAGE,
  MediaGenerationJobType.API_MEDIA_VIDEO,
  MediaGenerationJobType.API_MEDIA_UPSAMPLE_IMAGE,
  MediaGenerationJobType.API_MEDIA_UPSAMPLE_VIDEO,
];

export function isApiMediaJobType(type: MediaGenerationJobType): boolean {
  return API_MEDIA_JOB_TYPES.includes(type);
}

async function getApiMediaStreamLimit(apiMediaTokenId: string): Promise<number> {
  const token = await ApiMediaTokenModel.findById(apiMediaTokenId).select("streamCount").lean();
  if (!token) return 0;
  return token.streamCount ?? 1;
}

async function countActiveApiMediaJobs(apiMediaTokenId: string): Promise<number> {
  return MediaGenerationJobModel.countDocuments({
    type: { $in: API_MEDIA_JOB_TYPES },
    "metadata.apiMediaTokenId": apiMediaTokenId,
    status: {
      $in: [MediaGenerationJobStatus.QUEUED, MediaGenerationJobStatus.PROCESSING],
    },
  });
}

async function countProcessingApiMediaJobs(apiMediaTokenId: string): Promise<number> {
  return MediaGenerationJobModel.countDocuments({
    type: { $in: API_MEDIA_JOB_TYPES },
    "metadata.apiMediaTokenId": apiMediaTokenId,
    status: MediaGenerationJobStatus.PROCESSING,
  });
}

/** Enqueue: kiểm tra QUEUED + PROCESSING so với `streamCount` (-1 = không giới hạn). */
export async function assertApiMediaStreamAvailable(apiMediaTokenId: string): Promise<void> {
  const limit = await getApiMediaStreamLimit(apiMediaTokenId);
  if (limit < 0) return;

  const activeCount = await countActiveApiMediaJobs(apiMediaTokenId);
  if (activeCount >= limit) {
    const err: any = new Error(
      `Bạn đã đạt giới hạn luồng đồng thời (${activeCount}/${limit}). Vui lòng đợi job hiện tại hoàn thành.`
    );
    err.statusCode = 429;
    throw err;
  }
}

/** Worker pickup: chỉ đếm PROCESSING so với `streamCount`. */
export async function canStartApiMediaJobProcessing(apiMediaTokenId: string): Promise<boolean> {
  const limit = await getApiMediaStreamLimit(apiMediaTokenId);
  if (limit < 0) return true;
  if (limit <= 0) return false;

  const processingCount = await countProcessingApiMediaJobs(apiMediaTokenId);
  return processingCount < limit;
}
