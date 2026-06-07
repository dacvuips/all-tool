/**
 * Kiểm tra giới hạn luồng đồng thời theo customer.
 *
 * Mỗi customer có 2 giới hạn riêng (trong `googlePackage`):
 *   - `imageStreamCount` — job tạo ảnh
 *   - `videoStreamCount` — job tạo video
 *
 * Đếm job đang QUEUED hoặc PROCESSING trước khi cho phép tạo job mới.
 */
import { CustomerModel } from "../../libs/dal/customer";
import {
  MediaGenerationJobModel,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../libs/dal/mediaGenerationJob";

/** Các loại job thuộc luồng ảnh */
export const IMAGE_MEDIA_JOB_TYPES: ReadonlyArray<MediaGenerationJobType> = [
  MediaGenerationJobType.GENERATION_IMAGE,
  MediaGenerationJobType.GENERATION_ELEMENT_IMAGE,
  MediaGenerationJobType.COPY_VIDEO_GENERATE_IMAGE,
  MediaGenerationJobType.GENERATION_REVIEW_IMAGE,
];

/** Các loại job thuộc luồng video */
export const VIDEO_MEDIA_JOB_TYPES: ReadonlyArray<MediaGenerationJobType> = [
  MediaGenerationJobType.GENERATION_VIDEO,
  MediaGenerationJobType.GENERATION_ELEMENT_VIDEO,
  MediaGenerationJobType.GENERATION_ELEMENT_VIDEO_TO_VIDEO,
  MediaGenerationJobType.GENERATION_REVIEW_VIDEO,
];

export type MediaStreamCategory = "image" | "video";

/** Phân loại job → luồng ảnh hoặc video */
export function getMediaStreamCategory(type: MediaGenerationJobType): MediaStreamCategory {
  if (IMAGE_MEDIA_JOB_TYPES.includes(type)) return "image";
  if (VIDEO_MEDIA_JOB_TYPES.includes(type)) return "video";
  throw new Error(`Không xác định được luồng cho job type "${type}"`);
}

function getJobTypesByCategory(category: MediaStreamCategory): MediaGenerationJobType[] {
  return category === "image" ? [...IMAGE_MEDIA_JOB_TYPES] : [...VIDEO_MEDIA_JOB_TYPES];
}

/**
 * Đếm số job đang chờ hoặc đang xử lý của customer theo loại luồng.
 */
export async function countActiveMediaJobs(
  customerId: string,
  category: MediaStreamCategory
): Promise<number> {
  return MediaGenerationJobModel.countDocuments({
    customerId,
    type: { $in: getJobTypesByCategory(category) },
    status: {
      $in: [MediaGenerationJobStatus.QUEUED, MediaGenerationJobStatus.PROCESSING],
    },
  });
}

/**
 * Kiểm tra customer còn slot luồng trống không.
 * Throw 429 nếu đã đạt giới hạn `imageStreamCount` / `videoStreamCount`.
 */
export async function assertMediaStreamAvailable(
  customerId: string,
  type: MediaGenerationJobType
): Promise<void> {
  const category = getMediaStreamCategory(type);
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.imageStreamCount googlePackage.videoStreamCount")
    .lean();

  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }

  const limit =
    category === "image"
      ? customer.googlePackage?.imageStreamCount ?? 1
      : customer.googlePackage?.videoStreamCount ?? 1;

  const activeCount = await countActiveMediaJobs(customerId, category);

  if (activeCount >= limit) {
    const label = category === "image" ? "ảnh" : "video";
    const err: any = new Error(
      `Bạn đã đạt giới hạn luồng tạo ${label} (${activeCount}/${limit}). Vui lòng đợi job hiện tại hoàn thành.`
    );
    err.statusCode = 429;
    throw err;
  }
}
