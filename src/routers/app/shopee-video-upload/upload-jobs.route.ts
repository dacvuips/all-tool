/**
 * Upload jobs API.
 * POST /api/app/shopee-video-upload/jobs
 * GET  /api/app/shopee-video-upload/jobs/:id
 * POST /api/app/shopee-video-upload/jobs/batch
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import {
  createUploadJob,
  getUploadJob,
} from "../../../shopee-video-upload/queue/upload-job.store";
import "../../../shopee-video-upload/queue/upload-runner";
import { ShopeeUploadJobPayload } from "../../../shopee-video-upload/queue/upload-job.types";

function auth(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
}

function pickPayload(body: any, customerId: string): ShopeeUploadJobPayload {
  return {
    cookie: String(body?.cookie || ""),
    country: body?.country,
    proxy: body?.proxy,
    caption: body?.caption,
    productLink: body?.productLink,
    productId: body?.productId,
    videoUrl: body?.videoUrl,
    videoBase64: body?.videoBase64,
    username: body?.username,
    threadId: body?.threadId,
    customerId,
    signerBaseUrl: body?.signerBaseUrl,
    signerApiKey: body?.signerApiKey,
  };
}

export default [
  {
    method: "post",
    path: "/api/app/shopee-video-upload/jobs",
    midd: [],
    action: async (req: Request, res: Response) => {
      const ctx = auth(req);
      const payload = pickPayload(req.body, ctx.id);
      if (!payload.cookie && !payload.videoUrl && !payload.videoBase64) {
        // dry-run vẫn cho phép thiếu cookie
      }
      if (!payload.videoUrl && !payload.videoBase64) {
        // Cho phép dry-run không có video
        if (!String(process.env.SHOPEE_UPLOAD_DRY_RUN || "true").match(/^(1|true|yes)?$/i)) {
          // dry run default true — ok
        }
      }
      const job = createUploadJob(payload);
      res.status(202).json({
        success: true,
        jobId: job.id,
        status: job.status,
      });
    },
  },
  {
    method: "post",
    path: "/api/app/shopee-video-upload/jobs/batch",
    midd: [],
    action: async (req: Request, res: Response) => {
      const ctx = auth(req);
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (!items.length) {
        return res.status(400).json({ success: false, message: "items rỗng" });
      }
      const jobs = items.map((item: any) => createUploadJob(pickPayload(item, ctx.id)));
      res.status(202).json({
        success: true,
        jobs: jobs.map((j: { id: string; status: string; payload: { threadId?: string } }) => ({
          jobId: j.id,
          status: j.status,
          threadId: j.payload.threadId,
        })),
      });
    },
  },
  {
    method: "get",
    path: "/api/app/shopee-video-upload/jobs/:id",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      const job = getUploadJob(String(req.params.id || ""));
      if (!job) {
        return res.status(404).json({ success: false, message: "Không tìm thấy job" });
      }
      res.json({
        success: true,
        job: {
          id: job.id,
          status: job.status,
          threadId: job.payload.threadId,
          result: job.result,
          error: job.error,
          createdAt: job.createdAt,
          updatedAt: job.updatedAt,
        },
      });
    },
  },
];
