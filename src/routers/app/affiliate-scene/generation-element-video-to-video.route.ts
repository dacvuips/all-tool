import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { pollAndExtractVideo } from "../../api-media/handle-video-generation";
import { callVideoToVideoAPI } from "../../api-media/handle-video-to-video-generation";
import { processAndUploadImages } from "../../helpers/handleUploadGoogleLabImages";
import { fetchCaptchaData } from "../../helpers/validateApiKey";
import { ServiceImageEnum } from "../constanst";
import { ActionEnum, checkVideoLimit, incrementVideoCount, resolveArtStylePrompt } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-element-video-to-video/",
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
          video: {
            videoBytes: string | null;
            mimeType: string;
          };
          config?: {
            aspectRatio?: "16:9" | "9:16";
            generateAudio?: boolean;
            artStyleId?: string;
            artStyle?: string;
            /** Gửi từ client (useElementApi) */
            serviceImageType?: ServiceImageEnum;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);
        // Lấy captcha + credentials + projectId + accessToken

        const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
          await resolveArtStylePrompt({
            artStyleId: body.config?.artStyleId,
            artStyle: body.config?.artStyle,
          });
        if (resolvedArtStylePrompt && resolvedArtStyleName === body.config?.artStyle) {
          body.config.artStyle = resolvedArtStylePrompt;
        }
        const {
          captcha: recaptchaToken,
          sessionId,
          ProjectID: projectId,
          accessToken,
          Seed,
          Headers,
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

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        const params = {
          res: res,
          prompt: `${body.config?.artStyle} ${body.prompt}`,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          recaptchaToken,
          sessionId,
          projectId,
          accessToken,
          Seed,
          batchId: crypto.randomUUID(),
          headers: Headers,
        };

        const { mediaName } = await callVideoToVideoAPI(params);

        await pollAndExtractVideo({
          mediaName,
          accessToken,
          customerId: context.id,
          res,
          headers: Headers,
        });
        await incrementVideoCount(context.id);
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        // Check res.writableEnded to avoid ERR_STREAM_WRITE_AFTER_END
        // (pollAndExtractVideo có thể đã gọi res.end() trước khi throw)
        if (res.headersSent) {
          if (!res.writableEnded) {
            res.write(
              `data: ${JSON.stringify({
                type: "error",
                message: err?.message || "Lỗi server",
              })}\n\n`
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
