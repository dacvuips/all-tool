/**
 * Route POST tạo ảnh trong affiliate scene (có productImages / objectToPersonifyImages).
 *
 * Kiểm tra giới hạn luồng ảnh → lưu payload Redis → tạo job → trả `{ jobId }`.
 * Client subscribe `mediaGenerationJobChanged(jobId)` để nhận kết quả.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { sendEnqueueErrorResponse } from "../media-generation-job/send-enqueue-error";
import { checkImageLimit, ReferenceImageInput } from "./_shared";
import { ApiMediaAspectRatio } from "../../api-media/api-media-constants";

export default [
  {
    method: "post",
    path: "/api/app/generation-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          productImages?: string[];
          objectToPersonifyImages?: ReferenceImageInput[];
          productImagePrompt?: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: ApiMediaAspectRatio;
            noText?: boolean;
            imageModel?: string;
          };
          _metadata?: Record<string, unknown>;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkImageLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_IMAGE,
          requestPayload,
          metadata: _metadata,
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi enqueue: ${err?.message}`);
        sendEnqueueErrorResponse(res, err);
      }
    },
  },
];
