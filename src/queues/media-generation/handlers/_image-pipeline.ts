/**
 * Pipeline tạo ảnh dùng chung cho **mọi** image handler:
 *
 *   fetchCaptcha → uploadImages → callAisandboxImageAPI (có captchaRetry)
 *
 * Mỗi handler chỉ cần truyền `prompt` đã ráp xong + danh sách `images` cần upload.
 * Helper này tự gọi `emitter.progress(...)` ở các milestone — vì `progress()` cũng
 * tự check cancel, handler không cần kiểm tra thủ công.
 */
import logger from "../../../helpers/logger";
import { callAisandboxImageAPI, GeneratedImage } from "../../../routers/api-media/handle-image-generation";
import { processAndUploadImages } from "../../../routers/helpers/handleUploadGoogleLabImages";
import { ActionEnum } from "../../../routers/app/affiliate-scene/_shared";
import { CaptchaResponseData, fetchCaptchaData } from "../../../routers/helpers/validateApiKey";
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
  aspectRatio?: "16:9" | "9:16";
  imageGroups: ImageGroups;
  emitter: MediaJobEmitter;
  /** Prefix log để phân biệt giữa các handler */
  logPrefix?: string;
};

/**
 * Chạy toàn bộ pipeline tạo ảnh. Trả về mảng ảnh kết quả.
 * Throw lỗi nếu fail (worker bắt + chuyển sang FAILED).
 */
export async function runImagePipeline(
  args: RunImagePipelineArgs
): Promise<GeneratedImage[]> {
  const { customerId, prompt, aspectRatio, imageGroups, emitter, logPrefix = "generation-image" } = args;

  /** Upload tất cả ảnh theo nhóm theo thứ tự, gắn captcha hiện tại */
  const uploadAll = async (captcha: CaptchaResponseData): Promise<string[]> => {
    const { personifyImages = [], userImages = [], productImageUrls = [] } = imageGroups;
    const accessToken = captcha.accessToken;
    const projectId = captcha.ProjectID;

    let personifyNames: string[] = [];
    if (personifyImages.length > 0) {
      personifyNames = await processAndUploadImages(personifyImages, accessToken, projectId, customerId);
    }
    let userNames: string[] = [];
    if (userImages.length > 0) {
      userNames = await processAndUploadImages(userImages, accessToken, projectId, customerId);
    }
    let productNames: string[] = [];
    if (productImageUrls.length > 0) {
      productNames = await processAndUploadImages(productImageUrls, accessToken, projectId, customerId);
    }
    return [...personifyNames, ...userNames, ...productNames];
  };

  /** captchaRetry: khi Google trả lỗi reCAPTCHA → lấy captcha mới + upload lại ảnh */
  const captchaRetry = {
    actionType: ActionEnum.IMAGE_GENERATION,
    logPrefix,
    onRefresh: async (freshCaptcha: CaptchaResponseData) => {
      const uploadedImageNames = await uploadAll(freshCaptcha);
      return {
        prompt,
        aspectRatio,
        uploadedImageNames,
        recaptchaToken: freshCaptcha.captcha,
        sessionId: freshCaptcha.sessionId,
        projectId: freshCaptcha.ProjectID,
        accessToken: freshCaptcha.accessToken,
        headers: freshCaptcha.Headers,
        onProgress: async (progress: number, message?: string) => {
          await emitter.progress(progress, message);
        },
        captchaRetry,
      };
    },
  };

  await emitter.progress(15, "Đang lấy captcha...");
  const captcha = await fetchCaptchaData({
    type: ActionEnum.IMAGE_GENERATION,
    logPrefix,
  });

  await emitter.progress(25, "Đang upload ảnh tham chiếu...");
  const uploadedImageNames = await uploadAll(captcha);

  await emitter.progress(40, "Đang gửi yêu cầu tạo ảnh...");
  logger.info(`[${logPrefix}] Bắt đầu gọi API tạo ảnh (user ${customerId})`);

  const images = await callAisandboxImageAPI({
    prompt,
    aspectRatio,
    uploadedImageNames,
    recaptchaToken: captcha.captcha,
    sessionId: captcha.sessionId,
    projectId: captcha.ProjectID,
    accessToken: captcha.accessToken,
    headers: captcha.Headers,
    onProgress: async (progress, message) => {
      // callAisandboxImageAPI bắn progress 70 + 90 — chuyển tiếp qua emitter
      await emitter.progress(progress, message);
    },
    captchaRetry,
  });

  return images;
}
