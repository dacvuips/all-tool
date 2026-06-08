/**
 * Route POST tạo video từ video tham chiếu (Element Editor — video-to-video). Trả `{ jobId }`.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { ServiceImageEnum } from "../constanst";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { resolvePayloadPrompt } from "../../../queues/media-generation/handlers/_video-prompt";
import { checkVideoLimit } from "./_shared";

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
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          noText?: boolean;
          voiceDisable?: boolean;
          video: { videoBytes: string | null; mimeType: string };
          config?: {
            prompt?: string;
            aspectRatio?: "16:9" | "9:16";
            generateAudio?: boolean;
            noText?: boolean;
            voiceDisable?: boolean;
            artStyleId?: string;
            artStyle?: string;
            serviceImageType?: ServiceImageEnum;
          };
          _metadata?: Record<string, unknown>;
        };

        if (!resolvePayloadPrompt(body)) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }
        if (!body?.video?.videoBytes) {
          return res.status(400).json({ message: "Thiếu video tham chiếu" });
        }

        await checkVideoLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_ELEMENT_VIDEO_TO_VIDEO,
          requestPayload,
          metadata: _metadata,
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-element-video-to-video] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
