import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callAisandboxVideoAPI,
  pollAndExtractVideo,
} from "../../api-media/handle-video-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { fetchCaptchaData } from "../../helpers/validateApiKey";
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
            aspectRatio?: string;
            generateAudio?: boolean;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);
        // Lấy captcha + credentials + projectId + accessToken

        const {
          captcha: recaptchaToken,
          sessionId,
          ProjectID: projectId,
          accessToken,
        } = await fetchCaptchaData({
          type: ActionEnum.VIDEO_GENERATION,
          logPrefix: "generation-video",
        });
        // Upload ảnh lên Google Labs trước nếu có
        const uploadedImageNames = await processAndUploadImages(
          body.images || [],
          accessToken,
          projectId,
          context.id
        );

        logger.info(`[generation-video] Gọi Veo 3.1 fast (aisandbox) cho user ${context.id}`);

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const { mediaName } = await callAisandboxVideoAPI({
          res: res,
          prompt: body.prompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
        });

        logger.info(`[generation-video] Polling mediaName: ${mediaName}`);

        await pollAndExtractVideo({
          mediaName,
          accessToken,
          customerId: context.id,
          res,
        });
        await incrementVideoCount(context.id);
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
          );
          res.end();
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
