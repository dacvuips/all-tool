/**
 * Route POST tạo video (affiliate scene).
 * Kiểm tra giới hạn luồng video → lưu payload Redis → tạo job → trả `{ jobId }`.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { sendEnqueueErrorResponse } from "../media-generation-job/send-enqueue-error";
import { resolvePayloadPrompt } from "../../../queues/media-generation/handlers/_video-prompt";
import { checkVideoLimit } from "./_shared";

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
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          noText?: boolean;
          voiceDisable?: boolean;
          /** frame = startImage/endImage; component = Reference (1–3 ảnh) */
          video_mode?: string;
          config?: {
            prompt?: string;
            aspectRatio?: "16:9" | "9:16";
            generateAudio?: boolean;
            noText?: boolean;
            voiceDisable?: boolean;
            videoMode?: string;
            serviceImageType?: string;
          };
          _metadata?: Record<string, unknown>;
        };

        if (!resolvePayloadPrompt(body)) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkVideoLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_VIDEO,
          requestPayload,
          metadata: _metadata,
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi enqueue: ${err?.message}`);
        sendEnqueueErrorResponse(res, err);
      }
    },
  },
];
