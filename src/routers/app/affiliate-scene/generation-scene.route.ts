/**
 * POST /api/app/generation-scene/ — validate + checkLimit + enqueue → 202 { jobId }.
 * Client poll/subscribe mediaGenerationJob đến SUCCEEDED/FAILED.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { AffiliateVideoFormConfig, checkRequestLimit } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-scene/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: AffiliateVideoFormConfig;
          text?: string;
          objectToPersonifyCode?: string;
          productImages?: string[];
          objectToPersonifyImages?: import("./_shared").ReferenceImageInput[];
          _metadata?: Record<string, unknown>;
        };

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        await checkRequestLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId: context.id,
            type: MediaGenerationJobType.GENERATION_SCENE,
            requestPayload: requestPayload as unknown as Record<string, unknown>,
            metadata: _metadata,
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-scene] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
