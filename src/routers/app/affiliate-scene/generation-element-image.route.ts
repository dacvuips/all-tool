import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callAisandboxImageAPI } from "../../api-media/handle-image-generation";
import { initGenerationSSE, sendGenerationSSEError } from "../../api-media/generation-sse";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData, fetchCaptchaData } from "../../helpers/validateApiKey";
import { ActionEnum, checkImageLimit, incrementImageCount, resolveArtStylePrompt } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-element-image/",
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
          aspectRatio?: "16:9" | "9:16";
          noText?: boolean;
          artStyleId?: string;
          artStyle?: string;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkImageLimit(context.id);

        const sendSSE = initGenerationSSE(res);
        sendSSE({ type: "progress", progress: 10, message: "Đang chuẩn bị tạo ảnh..." });

        const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
          await resolveArtStylePrompt({
            artStyleId: body.artStyleId,
            artStyle: body.artStyle,
          });
        if (resolvedArtStylePrompt && resolvedArtStyleName === body.artStyle) {
          body.artStyle = resolvedArtStylePrompt;
        }

        const noTextStr = !body?.noText
          ? `\nIMPORTANT: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text.`
          : "";
        const fullPrompt = `${body.artStyle} ${body.prompt} ${noTextStr}`;

        const uploadImagesForCaptcha = async (captcha: CaptchaResponseData) => {
          if (!body.images?.length) return [] as string[];
          return processAndUploadImages(
            body.images || [],
            captcha.accessToken,
            captcha.ProjectID,
            context.id
          );
        };

        const captchaRetry = {
          actionType: ActionEnum.IMAGE_GENERATION,
          logPrefix: "generation-image",
          onRefresh: async (freshCaptcha: CaptchaResponseData) => {
            const uploadedImageNames = await uploadImagesForCaptcha(freshCaptcha);
            return {
              res,
              prompt: fullPrompt,
              aspectRatio: body.aspectRatio,
              uploadedImageNames,
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
        sendSSE({ type: "progress", progress: 25, message: "Đang upload ảnh..." });
        const uploadedImageNames = await uploadImagesForCaptcha(captcha);

        sendSSE({ type: "progress", progress: 40, message: "Đang gửi yêu cầu tạo ảnh..." });
        await callAisandboxImageAPI({
          res,
          prompt: fullPrompt,
          aspectRatio: body.aspectRatio,
          uploadedImageNames,
          recaptchaToken: captcha.captcha,
          sessionId: captcha.sessionId,
          projectId: captcha.ProjectID,
          accessToken: captcha.accessToken,
          headers: captcha.Headers,
          captchaRetry,
        });

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
