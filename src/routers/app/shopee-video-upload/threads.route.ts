/**
 * Threads batch start / pause / retry.
 * POST /api/app/shopee-video-upload/threads/start
 * POST /api/app/shopee-video-upload/threads/pause
 * POST /api/app/shopee-video-upload/threads/retry
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import {
  cancelQueuedForThreads,
  createUploadJob,
} from "../../../shopee-video-upload/queue/upload-job.store";
import "../../../shopee-video-upload/queue/upload-runner";
import { ShopeeUploadJobPayload } from "../../../shopee-video-upload/queue/upload-job.types";

function auth(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
}

/** Chỉ nhận http(s)/data URI — không nhận marker "indexeddb" / blob từ client */
function pickVideoFields(t: any): { videoUrl?: string; videoBase64?: string } {
  const b64 = String(t?.videoBase64 || "").trim();
  if (b64) return { videoBase64: b64 };

  const candidates = [t?.videoUrl, t?.videoFile]
    .map((x) => String(x || "").trim())
    .filter(Boolean);
  for (const u of candidates) {
    if (u.startsWith("http://") || u.startsWith("https://") || u.startsWith("data:")) {
      return { videoUrl: u };
    }
  }
  return {};
}

function toPayload(t: any, customerId: string): ShopeeUploadJobPayload {
  const video = pickVideoFields(t);
  return {
    cookie: String(t.cookie || ""),
    country: t.country,
    proxy: t.proxy,
    caption: t.caption,
    productLink: t.productLink,
    productId: t.productId,
    videoUrl: video.videoUrl,
    videoBase64: video.videoBase64,
    username: t.username,
    threadId: t.id || t.threadId,
    customerId,
    signerBaseUrl: t.signerBaseUrl,
    signerApiKey: t.signerApiKey,
  };
}

export default [
  {
    method: "post",
    path: "/api/app/shopee-video-upload/threads/start",
    midd: [],
    action: async (req: Request, res: Response) => {
      const ctx = auth(req);
      const threads = Array.isArray(req.body?.threads) ? req.body.threads : [];
      if (!threads.length) {
        return res.status(400).json({ success: false, message: "Chọn ít nhất 1 luồng" });
      }
      const jobs = threads.map((t: any) => createUploadJob(toPayload(t, ctx.id)));
      res.status(202).json({
        success: true,
        count: jobs.length,
        jobs: jobs.map((j: { id: string; status: string; payload: { threadId?: string } }) => ({
          jobId: j.id,
          threadId: j.payload.threadId,
          status: j.status,
        })),
      });
    },
  },
  {
    method: "post",
    path: "/api/app/shopee-video-upload/threads/pause",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      const threadIds: string[] = Array.isArray(req.body?.threadIds)
        ? req.body.threadIds.map(String)
        : [];
      const cancelled = cancelQueuedForThreads(threadIds);
      res.json({ success: true, cancelled });
    },
  },
  {
    method: "post",
    path: "/api/app/shopee-video-upload/threads/retry",
    midd: [],
    action: async (req: Request, res: Response) => {
      const ctx = auth(req);
      const threads = Array.isArray(req.body?.threads) ? req.body.threads : [];
      const jobs = threads.map((t: any) => createUploadJob(toPayload(t, ctx.id)));
      res.status(202).json({
        success: true,
        count: jobs.length,
        jobs: jobs.map((j: { id: string; status: string; payload: { threadId?: string } }) => ({
          jobId: j.id,
          threadId: j.payload.threadId,
          status: j.status,
        })),
      });
    },
  },
];
