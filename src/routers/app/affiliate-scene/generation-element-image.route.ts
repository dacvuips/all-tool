/**
 * Route POST tạo ảnh trong Element Editor.
 *
 * Refactor: route chỉ validate + checkLimit + enqueue → trả `{ jobId }` (HTTP 202).
 * Client subscribe `mediaGenerationJobChanged(jobId)` qua GraphQL (hoặc poll
 * `GET /api/app/media-generation-job/:id`) để theo dõi tiến độ & nhận kết quả.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { sendEnqueueErrorResponse } from "../media-generation-job/send-enqueue-error";
import { checkImageLimit } from "./_shared";

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
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          aspectRatio?: "16:9" | "9:16";
          noText?: boolean;
          artStyleId?: string;
          artStyle?: string;
          /** Metadata tự do từ client (sceneId, clientRequestId, ...) */
          _metadata?: Record<string, unknown>;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        // Fail-fast nếu hết quota — không enqueue
        await checkImageLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_ELEMENT_IMAGE,
          requestPayload,
          metadata: _metadata,
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-element-image] Lỗi enqueue: ${err?.message}`);
        sendEnqueueErrorResponse(res, err);
      }
    },
  },
];
