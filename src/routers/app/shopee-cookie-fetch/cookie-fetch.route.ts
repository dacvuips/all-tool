/**
 * API lấy cookie Shopee qua extension.
 *
 * POST /api/app/shopee-cookie-fetch/start
 * GET  /api/app/shopee-cookie-fetch/pending
 * POST /api/app/shopee-cookie-fetch/claim
 * POST /api/app/shopee-cookie-fetch/result
 * GET  /api/app/shopee-cookie-fetch/jobs/:id
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  completeCookieFetchJob,
  createCookieFetchJob,
  getCookieFetchJob,
  listActiveCookieFetchJobs,
  markCookieFetchRunning,
  toPublicCookieFetchJob,
} from "../../../helpers/shopee-cookie-fetch/job-store";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";

function auth(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
}

function isLocalRequest(req: Request) {
  const ip = String(req.ip || req.socket.remoteAddress || "");
  return (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "::ffff:127.0.0.1" ||
    ip.endsWith("127.0.0.1")
  );
}

function allowExtensionCors(res: Response) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function extractSpcF(cookie: string): string {
  const m = String(cookie || "").match(/(?:^|;\s*)spc_f=([^;]+)/i);
  return m?.[1] ? decodeURIComponent(m[1].trim()) : "";
}

export default [
  {
    method: "post",
    path: "/api/app/shopee-cookie-fetch/start",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const job = createCookieFetchJob({
          userId: String(req.body?.userId || ""),
          username: String(req.body?.username || ""),
          password: String(req.body?.password || ""),
          loginUrl: req.body?.loginUrl,
          seedSpcF: String(req.body?.spcF || req.body?.seedSpcF || "").trim(),
        });
        // Chỉ tạo job — extension tự mở 1 tab login (không gọi openNormalChrome
        // để tránh mở trùng 2 tab cùng lúc).
        logger.info(`[cookie-fetch] start id=${job.id} user=${job.username}`);
        return res.status(200).json({
          ok: true,
          job: toPublicCookieFetchJob(job),
          credentials: {
            username: job.username,
            password: String(req.body?.password || ""),
            loginUrl: job.loginUrl,
            spcF: job.seedSpcF || "",
          },
        });
      } catch (err: any) {
        return res.status(400).json({ ok: false, message: err?.message || "Không tạo được job" });
      }
    },
  },
  {
    method: "options",
    path: "/api/app/shopee-cookie-fetch/pending",
    midd: [],
    action: async (_req: Request, res: Response) => {
      allowExtensionCors(res);
      return res.status(204).end();
    },
  },
  {
    method: "get",
    path: "/api/app/shopee-cookie-fetch/pending",
    midd: [],
    action: async (req: Request, res: Response) => {
      allowExtensionCors(res);
      if (!isLocalRequest(req)) {
        return res.status(403).json({ ok: false, message: "Chỉ cho phép localhost" });
      }
      const jobs = listActiveCookieFetchJobs().map((j) => ({
        id: j.id,
        userId: j.userId,
        username: j.username,
        password: j.password,
        loginUrl: j.loginUrl,
        spcF: j.seedSpcF || "",
        status: j.status,
      }));
      return res.json({ ok: true, jobs });
    },
  },
  {
    method: "options",
    path: "/api/app/shopee-cookie-fetch/claim",
    midd: [],
    action: async (_req: Request, res: Response) => {
      allowExtensionCors(res);
      return res.status(204).end();
    },
  },
  {
    method: "post",
    path: "/api/app/shopee-cookie-fetch/claim",
    midd: [],
    action: async (req: Request, res: Response) => {
      allowExtensionCors(res);
      if (!isLocalRequest(req)) {
        return res.status(403).json({ ok: false, message: "Chỉ cho phép localhost" });
      }
      const id = String(req.body?.id || "");
      const job = markCookieFetchRunning(id);
      if (!job) return res.status(404).json({ ok: false, message: "Không tìm thấy job" });
      return res.json({
        ok: true,
        job: {
          id: job.id,
          userId: job.userId,
          username: job.username,
          password: job.password,
          loginUrl: job.loginUrl,
          spcF: job.seedSpcF || "",
          status: job.status,
        },
      });
    },
  },
  {
    method: "options",
    path: "/api/app/shopee-cookie-fetch/result",
    midd: [],
    action: async (_req: Request, res: Response) => {
      allowExtensionCors(res);
      return res.status(204).end();
    },
  },
  {
    method: "post",
    path: "/api/app/shopee-cookie-fetch/result",
    midd: [],
    action: async (req: Request, res: Response) => {
      allowExtensionCors(res);
      if (!isLocalRequest(req)) {
        return res.status(403).json({ ok: false, message: "Chỉ cho phép localhost" });
      }
      const id = String(req.body?.id || "");
      const status = String(req.body?.status || "error") as any;
      const cookie = String(req.body?.cookie || "").trim();
      const spcF = String(req.body?.spcF || "").trim() || extractSpcF(cookie);
      const error = String(req.body?.error || "").trim();
      const job = completeCookieFetchJob(id, { status, cookie, spcF, error });
      if (!job) return res.status(404).json({ ok: false, message: "Không tìm thấy job" });
      logger.info(`[cookie-fetch] result id=${id} status=${status}`);
      return res.json({ ok: true, job: toPublicCookieFetchJob(job) });
    },
  },
  {
    method: "get",
    path: "/api/app/shopee-cookie-fetch/jobs/:id",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const job = getCookieFetchJob(String(req.params.id || ""));
        if (!job) return res.status(404).json({ ok: false, message: "Không tìm thấy job" });
        return res.json({ ok: true, job: toPublicCookieFetchJob(job) });
      } catch (err: any) {
        return res.status(401).json({ ok: false, message: err?.message || "Unauthorized" });
      }
    },
  },
];
