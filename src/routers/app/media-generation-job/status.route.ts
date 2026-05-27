/**
 * REST endpoint fallback (không phụ thuộc GraphQL):
 *
 *   GET  /api/app/media-generation-job/:id         — trả trạng thái 1 job
 *   POST /api/app/media-generation-job/:id/cancel  — huỷ job
 *   POST /api/app/media-generation-job/:id/retry   — retry job FAILED
 *
 * Mục đích: khi WebSocket chưa kết nối được, client vẫn có thể poll qua REST để biết kết quả.
 * Mọi endpoint đều check `customerId === context.id` (security).
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
} from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { markMediaJobCancelled } from "../../../queues/media-generation/job-emitter";
import { retryMediaGenerationJob } from "../../../queues/media-generation/media-generation.queue";

/** Chuẩn hoá doc → response JSON (bỏ field nội bộ không cần thiết) */
function serialize(doc: IMediaGenerationJob | null) {
  if (!doc) return null;
  const json: any = (doc as any).toObject ? (doc as any).toObject() : doc;
  return {
    id: String(json._id),
    customerId: json.customerId,
    type: json.type,
    status: json.status,
    progress: json.progress ?? 0,
    message: json.message ?? null,
    resultData: json.resultData ?? null,
    errorMessage: json.errorMessage ?? null,
    errorCode: json.errorCode ?? null,
    metadata: json.metadata ?? null,
    attempts: json.attempts ?? 0,
    createdAt: json.createdAt,
    startedAt: json.startedAt ?? null,
    completedAt: json.completedAt ?? null,
  };
}

/** Tìm + kiểm tra ownership trong 1 hàm — DRY cho 3 route */
async function getOwnedJob(req: Request): Promise<IMediaGenerationJob> {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  const { id } = req.params as { id: string };
  const job = (await mediaGenerationJobService.findOne({
    _id: id,
  })) as unknown as IMediaGenerationJob | null;
  if (!job) {
    const err: any = new Error("Không tìm thấy job");
    err.statusCode = 404;
    throw err;
  }
  if ((job as any).customerId !== context.id) {
    const err: any = new Error("Bạn không có quyền truy cập job này");
    err.statusCode = 403;
    throw err;
  }
  return job;
}

export default [
  {
    method: "get",
    path: "/api/app/media-generation-job/:id",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const job = await getOwnedJob(req);
        res.json({ success: true, data: serialize(job) });
      } catch (err: any) {
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/media-generation-job/:id/cancel",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const job = await getOwnedJob(req);
        const ok = await markMediaJobCancelled(String((job as any)._id), (job as any).customerId);
        if (!ok) {
          // job đã ở trạng thái terminal — không cần cancel nữa
          logger.info(`[media-generation-job] Job ${(job as any)._id} đã terminal, bỏ qua cancel`);
        }
        const updated = (await mediaGenerationJobService.findOne({
          _id: (job as any)._id,
        })) as unknown as IMediaGenerationJob | null;
        res.json({ success: true, data: serialize(updated) });
      } catch (err: any) {
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/media-generation-job/:id/retry",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const job = await getOwnedJob(req);
        await retryMediaGenerationJob(String((job as any)._id));
        const updated = (await mediaGenerationJobService.findOne({
          _id: (job as any)._id,
        })) as unknown as IMediaGenerationJob | null;
        res.json({ success: true, data: serialize(updated) });
      } catch (err: any) {
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
