import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callAisandboxImageAPI } from "../../api-media/handle-image-generation";
import { initGenerationSSE, sendGenerationSSEError } from "../../api-media/generation-sse";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData, fetchCaptchaData } from "../../helpers/validateApiKey";
import {
  ActionEnum,
  buildImageReferenceNotes,
  checkImageLimit,
  filterReferenceImages,
  incrementImageCount,
  ReferenceImageInput,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/copy-video-generate-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          images?: Array<
            | string // URL ảnh
            | { imageBytes: string; mimeType?: string } // base64
          >;
          productImages?: string[];
          objectToPersonifyImages?: ReferenceImageInput[];
          productImagePrompt?: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
          };
          noText?: boolean;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkImageLimit(context.id);

        const sendSSE = initGenerationSSE(res);
        sendSSE({ type: "progress", progress: 10, message: "Đang chuẩn bị tạo ảnh..." });

        // Build product image reference note to append to prompt
        const productImageUrls = body.productImages?.filter(Boolean) || [];
        const personifyImageRefs = filterReferenceImages(body.objectToPersonifyImages);
        const imageReferenceNote = buildImageReferenceNotes({
          productUrls: productImageUrls,
          productCustomPrompt: body.productImagePrompt,
          personifyImages: personifyImageRefs,
        });

        // Tạo payload theo cấu trúc Google Labs API

        const noTextStr = !body.noText
          ? `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`
          : "";

        const fullPrompt = `${body.prompt} ${imageReferenceNote} ${noTextStr}`;

        const uploadImagesForCaptcha = async (captcha: CaptchaResponseData) => {
          const accessToken = captcha.accessToken;
          const projectId = captcha.ProjectID;

          let uploadedImageNames: string[] = [];
          if (body.images?.length > 0) {
            uploadedImageNames = await processAndUploadImages(
              body.images || [],
              accessToken,
              projectId,
              context.id
            );
          }

          let productImageNames: string[] = [];
          if (productImageUrls.length > 0) {
            productImageNames = await processAndUploadImages(
              productImageUrls,
              accessToken,
              projectId,
              context.id
            );
          }

          let personifyImageNames: string[] = [];
          if (personifyImageRefs.length > 0) {
            logger.info(
              `[copy-video-generate-image] Upload ${personifyImageRefs.length} ảnh nhân hoá đồ vật (user ${context.id})`
            );
            personifyImageNames = await processAndUploadImages(
              personifyImageRefs,
              accessToken,
              projectId,
              context.id
            );
          } else if (body.objectToPersonifyImages?.length) {
            logger.warn(
              `[copy-video-generate-image] objectToPersonifyImages có ${body.objectToPersonifyImages.length} phần tử nhưng không có imageBytes hợp lệ`
            );
          }

          return [...personifyImageNames, ...uploadedImageNames, ...productImageNames];
        };

        const captchaRetry = {
          actionType: ActionEnum.IMAGE_GENERATION,
          logPrefix: "generation-image",
          onRefresh: async (freshCaptcha: CaptchaResponseData) => {
            const names = await uploadImagesForCaptcha(freshCaptcha);
            return {
              res,
              prompt: fullPrompt,
              aspectRatio: body.config?.aspectRatio,
              uploadedImageNames: names,
              recaptchaToken: freshCaptcha.captcha,
              sessionId: freshCaptcha.sessionId,
              projectId: freshCaptcha.ProjectID,
              accessToken: freshCaptcha.accessToken,
              headers: freshCaptcha.Headers,
              captchaRetry,
            };
          },
        };

        sendSSE({ type: "progress", progress: 15, message: "Đang lấy captcha..." });
        const captcha = await fetchCaptchaData({
          type: ActionEnum.IMAGE_GENERATION,
          logPrefix: "generation-image",
        });
        sendSSE({ type: "progress", progress: 25, message: "Đang upload ảnh tham chiếu..." });
        const uploadedImageNames = await uploadImagesForCaptcha(captcha);

        sendSSE({ type: "progress", progress: 40, message: "Đang gửi yêu cầu tạo ảnh..." });
        await callAisandboxImageAPI({
          res,
          prompt: fullPrompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          recaptchaToken: captcha.captcha,
          sessionId: captcha.sessionId,
          projectId: captcha.ProjectID,
          accessToken: captcha.accessToken,
          headers: captcha.Headers,
          captchaRetry,
        });

        // Tạo ảnh thành công → tăng imageCount
        await incrementImageCount(context.id);
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi: ${err?.message}`);
        if (res.headersSent) {
          sendGenerationSSEError(res, err?.message || "Lỗi server", err?.statusCode || 500);
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
