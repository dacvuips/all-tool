/**
 * Route POST tạo ảnh cho Wolf Workspace.
 *
 * Giới hạn Wolf: prompt + tối đa 10 ảnh tham chiếu, model bananaPro/banana2, tỷ lệ 16:9|9:16.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkImageLimit } from "./_shared";
import { assertWolfImageRequest } from "./_wolf-generation.shared";

export default [
  {
    method: "post",
    path: "/api/app/generate-image-wolf/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          config?: {
            numberOfImages?: number;
            aspectRatio?: "16:9" | "9:16";
            imageModel?: string;
          };
          _metadata?: Record<string, unknown>;
        };

        assertWolfImageRequest(body);
        await checkImageLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_WOLF_IMAGE,
          requestPayload,
          metadata: { source: "wolf-workspace", ..._metadata },
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generate-image-wolf] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
