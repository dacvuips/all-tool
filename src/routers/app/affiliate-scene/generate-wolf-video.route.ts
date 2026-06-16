/**
 * Route POST tạo video cho Wolf Workspace.
 *
 * - component (Thành phần): chỉ prompt, hoặc kèm 1–3 ảnh tham chiếu
 * - frame (Khung hình): 1 ảnh startImage hoặc 2 ảnh startImage + endImage
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkVideoLimit } from "./_shared";
import { assertWolfVideoRequest } from "./_wolf-generation.shared";

export default [
  {
    method: "post",
    path: "/api/app/generate-video-wolf/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          video_mode?: string;
          config?: {
            prompt?: string;
            aspectRatio?: "16:9" | "9:16";
            videoMode?: string;
          };
          _metadata?: Record<string, unknown>;
        };

        const resolvedVideoMode = assertWolfVideoRequest(body);
        await checkVideoLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const normalizedPayload = resolvedVideoMode
          ? {
              ...requestPayload,
              video_mode: resolvedVideoMode,
              config: {
                ...requestPayload.config,
                videoMode: resolvedVideoMode,
              },
            }
          : requestPayload;

        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_WOLF_VIDEO,
          requestPayload: normalizedPayload,
          metadata: { source: "wolf-workspace", ..._metadata },
        });

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generate-video-wolf] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
