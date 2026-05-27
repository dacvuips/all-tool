/**
 * Pipeline tạo video dùng chung cho **mọi** video handler:
 *
 *   fetchCaptcha → upload media → callVideo (có captchaRetry) → poll → trả videoUri
 *
 * Handler chỉ cần build prompt + chỉ định "API mode" (text-only, start-image, video-to-video, ...).
 */
import logger from "../../../helpers/logger";
import {
  callReferenceImagesAPI,
  callStartAndEndImageAPI,
  callStartImageAPI,
  callTextOnlyAPI,
  callVideoAPIWithCaptchaRetry,
  PollVideoResult,
  pollAndExtractVideo,
} from "../../../routers/api-media/handle-video-generation";
import { callVideoToVideoAPI } from "../../../routers/api-media/handle-video-to-video-generation";
import {
  processAndUploadImages,
  processAndUploadVideo,
} from "../../../routers/helpers/handleUploadGoogleLabImages";
import { ActionEnum } from "../../../routers/app/affiliate-scene/_shared";
import { CaptchaResponseData, fetchCaptchaData } from "../../../routers/helpers/validateApiKey";
import { MediaJobEmitter } from "../job-emitter";

/** Chọn loại API video sẽ gọi */
export type VideoApiMode =
  /** text → video hoặc text + reference images */
  | "text-or-reference"
  /** 1 ảnh đầu (start image) → video */
  | "start-image"
  /** 2 ảnh (start + end image) → video */
  | "start-end-image"
  /** Reference images (nhiều ảnh) → video */
  | "reference-images"
  /** Video tham chiếu (video-to-video) → video */
  | "video-to-video";

export type RunVideoPipelineArgs = {
  customerId: string;
  /** Prompt đã ráp xong (artStyle + prompt) */
  prompt: string;
  aspectRatio?: "16:9" | "9:16";
  /** Ảnh ref (base64/url) — upload trước khi gọi API */
  images?: Array<string | { imageBytes: string; mimeType?: string }>;
  /** Video tham chiếu (chỉ dùng cho mode `video-to-video`) */
  videoReference?: { videoBytes: string | null; mimeType: string };
  apiMode: VideoApiMode;
  emitter: MediaJobEmitter;
  /** Prefix log */
  logPrefix?: string;
};

/**
 * Chạy pipeline video. Trả về kết quả poll (videoUri).
 * Throw nếu fail → worker bắt + chuyển sang FAILED.
 */
export async function runVideoPipeline(args: RunVideoPipelineArgs): Promise<PollVideoResult> {
  const {
    customerId,
    prompt,
    aspectRatio,
    images = [],
    videoReference,
    apiMode,
    emitter,
    logPrefix = "generation-video",
  } = args;

  /** Upload ảnh + video tham chiếu (nếu có) ứng với captcha hiện tại */
  const uploadAll = async (captcha: CaptchaResponseData) => {
    const uploadedImageNames = await processAndUploadImages(
      images,
      captcha.accessToken,
      captcha.ProjectID,
      customerId
    );
    let uploadedVideoMediaId: string | undefined;
    if (apiMode === "video-to-video") {
      if (!videoReference?.videoBytes) {
        const err: any = new Error("Thiếu video tham chiếu");
        err.statusCode = 400;
        throw err;
      }
      const id = await processAndUploadVideo(
        videoReference,
        captcha.accessToken,
        captcha.ProjectID,
        customerId
      );
      if (!id) {
        const err: any = new Error("Không thể upload video tham chiếu");
        err.statusCode = 400;
        throw err;
      }
      uploadedVideoMediaId = id;
    }
    return { uploadedImageNames, uploadedVideoMediaId };
  };

  /** Xây CallAisandbox params từ captcha + media đã upload */
  const buildParams = (
    captcha: CaptchaResponseData,
    uploaded: { uploadedImageNames: string[]; uploadedVideoMediaId?: string }
  ) => ({
    // legacy interface yêu cầu `res`; nhưng các hàm callAisandbox đã refactor không dùng — pass placeholder
    res: undefined as any,
    prompt,
    aspectRatio: (aspectRatio || "9:16") as "16:9" | "9:16",
    uploadedImageNames: uploaded.uploadedImageNames,
    uploadedVideoNames: uploaded.uploadedVideoMediaId ? [uploaded.uploadedVideoMediaId] : undefined,
    recaptchaToken: captcha.captcha,
    sessionId: captcha.sessionId,
    projectId: captcha.ProjectID,
    accessToken: captcha.accessToken,
    Seed: captcha.Seed,
    batchId: crypto.randomUUID(),
    headers: captcha.Headers,
  });

  const captchaRetry: any = {
    actionType: ActionEnum.VIDEO_GENERATION,
    logPrefix,
    onRefresh: async (freshCaptcha: CaptchaResponseData) => {
      const uploaded = await uploadAll(freshCaptcha);
      return { ...buildParams(freshCaptcha, uploaded), captchaRetry };
    },
  };

  await emitter.progress(15, "Đang lấy captcha...");
  const captcha = await fetchCaptchaData({
    type: ActionEnum.VIDEO_GENERATION,
    logPrefix,
  });

  await emitter.progress(
    25,
    apiMode === "video-to-video" ? "Đang upload media..." : "Đang upload ảnh..."
  );
  const uploaded = await uploadAll(captcha);

  await emitter.progress(40, "Đang gửi yêu cầu tạo video...");
  logger.info(`[${logPrefix}] Bắt đầu gọi API video (mode=${apiMode}, user=${customerId})`);

  const videoParams = { ...buildParams(captcha, uploaded), captchaRetry };

  // Dispatch loại API
  const callFn = (params: typeof videoParams) => {
    switch (apiMode) {
      case "start-image":
        return callStartImageAPI(params);
      case "start-end-image":
        return callStartAndEndImageAPI(params);
      case "reference-images":
        return callReferenceImagesAPI(params);
      case "video-to-video":
        return callVideoToVideoAPI(params);
      case "text-or-reference":
      default: {
        if (params.uploadedImageNames && params.uploadedImageNames.length > 0) {
          return callReferenceImagesAPI(params);
        }
        return callTextOnlyAPI(params);
      }
    }
  };

  const { mediaName, accessToken, headers } = await callVideoAPIWithCaptchaRetry(
    videoParams,
    callFn
  );

  // Poll cho đến khi Google trả kết quả; emit progress 50→95 trong khi chờ
  return pollAndExtractVideo({
    mediaName,
    accessToken,
    customerId,
    headers,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
  });
}
