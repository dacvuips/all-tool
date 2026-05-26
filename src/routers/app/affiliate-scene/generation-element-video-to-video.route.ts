import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callVideoAPIWithCaptchaRetry,
  initVideoGenerationSSE,
  pollAndExtractVideo,
  sendVideoGenerationSSEError,
} from "../../api-media/handle-video-generation";
import { callVideoToVideoAPI } from "../../api-media/handle-video-to-video-generation";
import {
  processAndUploadImages,
  processAndUploadVideo,
} from "../../helpers/handleUploadGoogleLabImages";
import { CaptchaResponseData, fetchCaptchaData } from "../../helpers/validateApiKey";
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

        if (!body?.video?.videoBytes) {
          return res.status(400).json({ message: "Thiếu video tham chiếu" });
        }

        await checkVideoLimit(context.id);

        const sendSSE = initVideoGenerationSSE(res);
        sendSSE({ type: "progress", progress: 10, message: "Đang chuẩn bị tạo video..." });

        const { prompt: resolvedArtStylePrompt, name: resolvedArtStyleName } =
          await resolveArtStylePrompt({
            artStyleId: body.config?.artStyleId,
            artStyle: body.config?.artStyle,
          });
        if (resolvedArtStylePrompt && resolvedArtStyleName === body.config?.artStyle) {
          body.config.artStyle = resolvedArtStylePrompt;
        }
        const videoPrompt = `${body.config?.artStyle} ${body.prompt}`;

        const uploadMediaForCaptcha = async (captcha: CaptchaResponseData) => {
          const uploadedImageNames = await processAndUploadImages(
            body.images || [],
            captcha.accessToken,
            captcha.ProjectID,
            context.id
          );
          const uploadedVideoMediaId = await processAndUploadVideo(
            body.video,
            captcha.accessToken,
            captcha.ProjectID,
            context.id
          );
          if (!uploadedVideoMediaId) {
            const err: any = new Error("Không thể upload video tham chiếu");
            err.statusCode = 400;
            throw err;
          }
          return { uploadedImageNames, uploadedVideoMediaId };
        };

        const captchaRetry = {
          actionType: ActionEnum.VIDEO_GENERATION,
          logPrefix: "generation-video",
          onRefresh: async (freshCaptcha: CaptchaResponseData) => {
            const { uploadedImageNames, uploadedVideoMediaId } =
              await uploadMediaForCaptcha(freshCaptcha);
            return {
              res,
              prompt: videoPrompt,
              aspectRatio: body.config?.aspectRatio,
              uploadedImageNames,
              uploadedVideoNames: [uploadedVideoMediaId],
              recaptchaToken: freshCaptcha.captcha,
              sessionId: freshCaptcha.sessionId,
              projectId: freshCaptcha.ProjectID,
              accessToken: freshCaptcha.accessToken,
              Seed: freshCaptcha.Seed,
              batchId: crypto.randomUUID(),
              headers: freshCaptcha.Headers,
              captchaRetry,
            };
          },
        };

        sendSSE({ type: "progress", progress: 15, message: "Đang lấy captcha..." });
        const captcha = await fetchCaptchaData({
          type: ActionEnum.VIDEO_GENERATION,
          logPrefix: "generation-video",
        });
        sendSSE({ type: "progress", progress: 25, message: "Đang upload media..." });
        const { uploadedImageNames, uploadedVideoMediaId } = await uploadMediaForCaptcha(captcha);

        const videoParams = {
          res,
          prompt: videoPrompt,
          aspectRatio: body.config?.aspectRatio,
          uploadedImageNames,
          uploadedVideoNames: [uploadedVideoMediaId],
          recaptchaToken: captcha.captcha,
          sessionId: captcha.sessionId,
          projectId: captcha.ProjectID,
          accessToken: captcha.accessToken,
          Seed: captcha.Seed,
          batchId: crypto.randomUUID(),
          headers: captcha.Headers,
          captchaRetry,
        };

        sendSSE({ type: "progress", progress: 40, message: "Đang gửi yêu cầu tạo video..." });
        const { mediaName, accessToken, headers } = await callVideoAPIWithCaptchaRetry(
          videoParams,
          (params) => callVideoToVideoAPI(params)
        );

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
        if (res.headersSent) {
          sendVideoGenerationSSEError(res, err?.message || "Lỗi server");
        } else {
          const status = err?.statusCode || 500;
          res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
