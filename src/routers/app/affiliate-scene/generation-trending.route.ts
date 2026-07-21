/**
 * POST /api/app/generation-trending/ — validate + checkLimit + enqueue → 202 { jobId }.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { CheckTrendingAccess } from "../../../libs/usecases/trending-purchase-order/check-trending-access.usecase";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkRequestLimit, TrendingVideoFormConfig } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-trending/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: TrendingVideoFormConfig;
          productImages?: string[];
          _metadata?: Record<string, unknown>;
        };

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        if (body.config.promptId) {
          await CheckTrendingAccess.requireAccess(context.id, body.config.promptId);
        }

        await checkRequestLimit(context.id);

        const { _metadata, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId: context.id,
            type: MediaGenerationJobType.GENERATION_TRENDING,
            requestPayload: requestPayload as unknown as Record<string, unknown>,
            metadata: _metadata,
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-trending] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
