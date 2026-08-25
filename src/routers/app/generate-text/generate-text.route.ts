/**
 * POST   /api/app/generate-text/
 *   - mặc định: enqueue job GENERATE_TEXT → 202 { jobId }
 *   - direct: true → gọi Flow2 sync, trả kết quả ngay (dùng cho audio/image to video analyze)
 * GET    /api/app/generate-text/:id/    poll status Flow2 request
 * DELETE /api/app/generate-text/:id/    hủy Flow2 request khi queued/running
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import {
  cancelFlow2TextRequest,
  generateTextWithFlow2,
  getFlow2TextRequestStatus,
  sanitizeFlow2TextStatus,
  serializeFlow2TextClientResult,
} from "../../api-media/flow2";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkRequestLimit, incrementRequestCount } from "../affiliate-scene/_shared";
import { parseGenerateTextParams, type GenerateTextBody } from "./generate-text.params";

function sendRouteError(res: Response, err: any) {
  const status = err?.statusCode || 500;
  res.status(status).json({ message: err?.message || "Lỗi server" });
}

function asTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

export default [
  {
    method: "post",
    path: "/api/app/generate-text/",
    midd: [],
    action: async (req: Request, res: Response) => {
      let requestId = "";
      const onClose = () => {
        if (!requestId) return;
        void cancelFlow2TextRequest(requestId, contextId).catch(() => undefined as void);
      };
      let contextId = "";

      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        contextId = context.id;

        const body = (req.body || {}) as GenerateTextBody & {
          _metadata?: Record<string, unknown>;
          /** true = gọi Flow2 thẳng, không enqueue media job */
          direct?: boolean;
          sync?: boolean;
        };
        const params = parseGenerateTextParams(body);
        await checkRequestLimit(context.id);

        const useDirect = body.direct === true || body.sync === true;
        if (useDirect) {
          req.on("close", onClose);
          const { requestId: createdId, result } = await generateTextWithFlow2({
            ...params,
            customerId: context.id,
            onRequestCreated: async (id: string) => {
              requestId = id;
            },
          });
          requestId = createdId;
          req.off("close", onClose);

          await incrementRequestCount(context.id);
          return res.json({
            success: true,
            requestId: createdId,
            status: "done",
            type: "gen_text",
            data: serializeFlow2TextClientResult(result),
          });
        }

        const { _metadata, direct: _direct, sync: _sync, ...requestPayload } = body;
        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId: context.id,
            type: MediaGenerationJobType.GENERATE_TEXT,
            requestPayload: requestPayload as Record<string, unknown>,
            metadata: _metadata,
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        req.off("close", onClose);
        logger.error(`[generate-text] Lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/generate-text/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const id = asTrimmed(req.params.id);
        if (!id) return res.status(400).json({ message: "Thiếu request id" });

        const statusData = await getFlow2TextRequestStatus(id, context.id);
        res.json({ success: true, data: sanitizeFlow2TextStatus(statusData) });
      } catch (err: any) {
        logger.error(`[generate-text] Poll lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "delete",
    path: "/api/app/generate-text/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const id = asTrimmed(req.params.id);
        if (!id) return res.status(400).json({ message: "Thiếu request id" });

        const cancelled = await cancelFlow2TextRequest(id, context.id);
        res.json({
          success: true,
          cancelled,
          message: cancelled
            ? "Đã gửi yêu cầu hủy task"
            : "Không hủy được (task có thể đã xong hoặc không còn queued/running)",
        });
      } catch (err: any) {
        logger.error(`[generate-text] Hủy lỗi: ${err?.message}`);
        sendRouteError(res, err);
      }
    },
  },
];
