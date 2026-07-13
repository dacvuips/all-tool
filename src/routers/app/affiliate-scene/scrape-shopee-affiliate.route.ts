/**
 * API cào Shopee Affiliate — mở browser + nhận CSV từ extension.
 *
 * POST /api/app/scrape-shopee-affiliate/open-browser
 * POST /api/app/scrape-shopee-affiliate/extension-push
 * GET  /api/app/scrape-shopee-affiliate/extension-pending?knownIds=
 * POST /api/app/scrape-shopee-affiliate/extension-ack
 * GET  /api/app/scrape-shopee-affiliate/extension-package
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  ackExtensionSessions,
  buildExtensionZipBuffer,
  listPendingExtensionSessions,
  openAffiliateBrowser,
  pushExtensionCsv,
} from "../../../helpers/shopee-affiliate-scrape";
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

export default [
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/open-browser",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const marketHost = String(req.body?.marketHost || "affiliate.shopee.vn").trim();
        const result = await openAffiliateBrowser(marketHost);
        logger.info(`[scrape-shopee] open-browser host=${result.marketHost}`);
        return res.status(200).json({ ok: true, ...result });
      } catch (err: any) {
        logger.error(`[scrape-shopee] open-browser: ${err?.message || err}`);
        return res.status(400).json({ ok: false, message: err?.message || "Không mở được trình duyệt" });
      }
    },
  },
  {
    method: "options",
    path: "/api/app/scrape-shopee-affiliate/extension-push",
    midd: [],
    action: async (_req: Request, res: Response) => {
      allowExtensionCors(res);
      return res.status(204).end();
    },
  },
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/extension-push",
    midd: [],
    action: async (req: Request, res: Response) => {
      allowExtensionCors(res);
      try {
        if (!isLocalRequest(req)) {
          return res.status(403).json({ ok: false, message: "Chỉ cho phép localhost" });
        }
        const session = pushExtensionCsv({
          products: Array.isArray(req.body?.products) ? req.body.products : [],
          keyword: req.body?.keyword ? String(req.body.keyword) : undefined,
          marketHost: req.body?.marketHost ? String(req.body.marketHost) : undefined,
          marketCode: req.body?.marketCode ? String(req.body.marketCode) : undefined,
          durationMs: Number(req.body?.durationMs) || 0,
          csv: req.body?.csv ? String(req.body.csv) : undefined,
        });
        logger.info(
          `[scrape-shopee] extension-push id=${session.id} host=${session.marketHost} count=${session.productCount}`
        );
        return res.status(200).json({ ok: true, session });
      } catch (err: any) {
        return res.status(400).json({ ok: false, message: err?.message || "Gửi CSV lỗi" });
      }
    },
  },
  {
    method: "options",
    path: "/api/app/scrape-shopee-affiliate/extension-pending",
    midd: [],
    action: async (_req: Request, res: Response) => {
      allowExtensionCors(res);
      return res.status(204).end();
    },
  },
  {
    method: "get",
    path: "/api/app/scrape-shopee-affiliate/extension-pending",
    midd: [],
    action: async (req: Request, res: Response) => {
      allowExtensionCors(res);
      try {
        auth(req);
        const raw = String(req.query?.knownIds || "");
        const knownIds = raw
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        const sessions = listPendingExtensionSessions(knownIds);
        return res.status(200).json({ ok: true, sessions });
      } catch (err: any) {
        return res.status(401).json({ ok: false, message: err?.message || "Unauthorized" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/extension-ack",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
        const removed = ackExtensionSessions(ids);
        return res.status(200).json({ ok: true, removed });
      } catch (err: any) {
        return res.status(401).json({ ok: false, message: err?.message || "Unauthorized" });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/scrape-shopee-affiliate/extension-package",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const { buffer, filename, fileCount } = await buildExtensionZipBuffer();
        logger.info(`[scrape-shopee] extension-package files=${fileCount} bytes=${buffer.length}`);
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
        res.setHeader("Content-Length", String(buffer.length));
        return res.status(200).send(buffer);
      } catch (err: any) {
        logger.error(`[scrape-shopee] extension-package: ${err?.message || err}`);
        return res.status(400).json({
          ok: false,
          message: err?.message || "Không tạo được gói extension",
        });
      }
    },
  },
];
