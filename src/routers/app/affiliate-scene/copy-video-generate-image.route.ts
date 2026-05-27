/**
 * Route POST tạo ảnh cho module Copy Video.
 *
 * Trả `{ jobId }`; client theo dõi qua subscription `mediaGenerationJobChanged(jobId)`.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkImageLimit, ReferenceImageInput } from "./_shared";

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
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          productImages?: string[];
          objectToPersonifyImages?: ReferenceImageInput[];
          productImagePrompt?: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
          };
          noText?: boolean;
          _metadata?: Record<string, unknown>;
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkImageLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.COPY_VIDEO_GENERATE_IMAGE,
          requestPayload,
          metadata: _metadata,
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[copy-video-generate-image] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
