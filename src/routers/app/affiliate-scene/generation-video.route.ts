import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callAisandboxVideoAPI,
  pollAndExtractVideo,
} from "../../api-media/handle-video-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData, fetchCaptchaData } from "../../helpers/validateApiKey";
import { ActionEnum, checkVideoLimit, incrementVideoCount } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-video/",
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
          config?: {
            aspectRatio?: "16:9" | "9:16";
            generateAudio?: boolean;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);
        // Lấy captcha + credentials + projectId + accessToken

        const buildVideoParams = (
          captcha: CaptchaResponseData,
          uploadedImageNames: string[]
        ) => ({
          res,
          prompt: body.prompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          recaptchaToken: captcha.captcha,
          sessionId: captcha.sessionId,
          projectId: captcha.ProjectID,
          accessToken: captcha.accessToken,
          Seed: captcha.Seed,
          batchId: crypto.randomUUID(),
          headers: captcha.Headers,
        });

        const captchaRetry = {
          actionType: ActionEnum.VIDEO_GENERATION,
          logPrefix: "generation-video",
          onRefresh: async (freshCaptcha: CaptchaResponseData) => {
            const uploadedImageNames = await processAndUploadImages(
              body.images || [],
              freshCaptcha.accessToken,
              freshCaptcha.ProjectID,
              context.id
            );
            return {
              ...buildVideoParams(freshCaptcha, uploadedImageNames),
              captchaRetry,
            };
          },
        };

        const captcha = await fetchCaptchaData({
          type: ActionEnum.VIDEO_GENERATION,
          logPrefix: "generation-video",
        });
        const uploadedImageNames = await processAndUploadImages(
          body.images || [],
          captcha.accessToken,
          captcha.ProjectID,
          context.id
        );

        const { mediaName, accessToken, headers } = await callAisandboxVideoAPI({
          ...buildVideoParams(captcha, uploadedImageNames),
          captchaRetry,
        });

        const pollSuccess = await pollAndExtractVideo({
          mediaName,
          accessToken,
          customerId: context.id,
          res,
          headers,
        });
        if (!pollSuccess) {
          return;
        }
        await incrementVideoCount(context.id);
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        // Check res.writableEnded to avoid ERR_STREAM_WRITE_AFTER_END
        // (pollAndExtractVideo có thể đã gọi res.end() trước khi throw)
        if (res.headersSent) {
          if (!res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
            );
            res.end();
          }
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
