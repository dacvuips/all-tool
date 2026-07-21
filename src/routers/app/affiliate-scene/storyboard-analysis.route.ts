/**
 * Storyboard analysis:
 * - POST /reserve-requests — reserve N quota slots (batch)
 * - POST / — enqueue job → 202 { jobId }; client poll mediaGenerationJob
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { releaseRequestSlots, reserveRequestSlots } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/storyboard-analysis/reserve-requests",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const count = Number((req.body as { count?: number })?.count);
        if (!Number.isFinite(count) || count < 1 || count > 20) {
          return res.status(400).json({ message: "Số lượng request không hợp lệ (1–20)" });
        }

        await reserveRequestSlots(context.id, count);
        res.json({ success: true, count });
      } catch (err: any) {
        logger.error(`[storyboard-analysis/reserve-requests] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/storyboard-analysis/",
    midd: [],
    action: async (req: Request, res: Response) => {
      let customerId = "";
      let reservedSingleSlot = false;

      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        customerId = context.id;

        const body = req.body as {
          storyboardImageBase64: string;
          mimeType?: string;
          artStyle?: string;
          artStyleId?: string;
          language?: string;
          aspectRatio?: string;
          tipContent?: string;
          productImages?: string[];
          skipRequestReservation?: boolean;
          _metadata?: Record<string, unknown>;
        };

        if (!body?.storyboardImageBase64) {
          return res.status(400).json({ message: "Thiếu ảnh storyboard (storyboardImageBase64)" });
        }

        const skipRequestReservation = body.skipRequestReservation === true;
        if (!skipRequestReservation) {
          await reserveRequestSlots(customerId, 1);
          reservedSingleSlot = true;
        }

        const { _metadata, ...rest } = body;
        const requestPayload = {
          ...rest,
          skipRequestReservation,
          reservedSingleSlot,
        };

        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId,
            type: MediaGenerationJobType.STORYBOARD_ANALYSIS,
            requestPayload: requestPayload as unknown as Record<string, unknown>,
            metadata: {
              ...(_metadata || {}),
              /** Luôn đã reserve 1 slot (route hoặc batch) — hoàn trả khi fail/cancel */
              storyboardQuotaReserved: true,
            },
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        if (customerId && reservedSingleSlot) {
          try {
            await releaseRequestSlots(customerId, 1);
          } catch (releaseErr: any) {
            logger.error(
              `[storyboard-analysis] Hoàn trả quota sau enqueue fail: ${releaseErr?.message}`
            );
          }
        }
        logger.error(`[storyboard-analysis] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
