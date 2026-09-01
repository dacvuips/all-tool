/**
 * Pipeline tạo ảnh dùng chung cho **mọi** image handler:
 *
 *   chuẩn hoá ảnh base64/url → gọi Flow2 create request → poll status
 *
 * Mỗi handler chỉ cần truyền `prompt` đã ráp xong + danh sách `images` cần upload.
 * Helper này tự gọi `emitter.progress(...)` ở các milestone — vì `progress()` cũng
 * tự check cancel, handler không cần kiểm tra thủ công.
 */
import logger from "../../../helpers/logger";
import { GeneratedImage, generateImageWithFlow2 } from "../../../routers/api-media/flow2/image-generation";
import { ApiMediaAspectRatio, normalizeApiMediaAspectRatio } from "../../../routers/api-media/api-media-constants";
import { MediaJobEmitter } from "../job-emitter";

import { UploadableReferenceImage } from "../../../routers/app/affiliate-scene/_shared";

/** Mỗi nhóm ảnh cần upload riêng để giữ thứ tự (personify → user → product). */
export type ImageGroups = {
  /**
   * Ảnh nhân hoá đồ vật đã `filterReferenceImages(...)` — luôn upload đầu tiên.
   * Caller chịu trách nhiệm chuẩn hoá thành `UploadableReferenceImage[]`.
   */
  personifyImages?: UploadableReferenceImage[];
  /** Ảnh user upload (referenceImage / additionalImages) */
  userImages?: Array<string | { imageBytes: string; mimeType?: string }>;
  /** Ảnh sản phẩm (URL) */
  productImageUrls?: string[];
};

export type RunImagePipelineArgs = {
  customerId: string;
  /** Prompt đã ráp xong (artStyle + prompt + reference notes + noText) */
  prompt: string;
  aspectRatio?: ApiMediaAspectRatio;
  variantCount?: number;
  imageModel?: string;
  imageGroups: ImageGroups;
  emitter: MediaJobEmitter;
  /** Prefix log để phân biệt giữa các handler */
  logPrefix?: string;
};

/**
 * Chạy toàn bộ pipeline tạo ảnh. Trả về mảng ảnh kết quả.
 * Throw lỗi nếu fail (worker bắt + chuyển sang FAILED).
 */
export async function runImagePipeline(args: RunImagePipelineArgs): Promise<GeneratedImage[]> {
  const {
    customerId,
    prompt,
    aspectRatio,
    variantCount,
    imageModel,
    imageGroups,
    emitter,
    logPrefix = "generation-image",
  } = args;

  const { personifyImages = [], userImages = [], productImageUrls = [] } = imageGroups;
  const orderedInputs = [...personifyImages, ...userImages, ...productImageUrls];

  await emitter.progress(20, "Đang chuẩn hoá ảnh tham chiếu...");
  logger.info(`[${logPrefix}] Bắt đầu gọi Flow2 tạo ảnh (user ${customerId})`);

  const { requestId, images } = await generateImageWithFlow2({
    prompt,
    aspectRatio: normalizeApiMediaAspectRatio(aspectRatio),
    variantCount,
    imageModel,
    imageInputs: orderedInputs,
    imageInputTypes: new Array(orderedInputs.length).fill("reference"),
    customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  logger.info(`[${logPrefix}] Flow2 request ${requestId} hoàn tất (user ${customerId})`);
  await emitter.progress(95, "Đang hoàn tất dữ liệu ảnh...");
  return images;
}
