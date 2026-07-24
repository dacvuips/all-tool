/**
 * POST /api/app/suggest-config/ — enqueue → 202 { jobId }.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkRequestLimit } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/suggest-config/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          category?: string;
          mood?: string;
          language?: string;
          _metadata?: Record<string, unknown>;
        };

        await checkRequestLimit(context.id);

        const { _metadata, ...requestPayload } = body || {};
        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId: context.id,
            type: MediaGenerationJobType.SUGGEST_CONFIG,
            requestPayload: requestPayload as Record<string, unknown>,
            metadata: _metadata,
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[suggest-config] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
