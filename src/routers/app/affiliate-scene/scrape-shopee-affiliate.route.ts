/**
 * API cào Shopee Affiliate — GemLogin CDP (không dùng Chrome extension).
 *
 * GET  /api/app/scrape-shopee-affiliate/gemlogin-status
 * GET  /api/app/scrape-shopee-affiliate/gemlogin-profiles
 * POST /api/app/scrape-shopee-affiliate/open-browser
 * GET  /api/app/scrape-shopee-affiliate/cdp-status
 * POST /api/app/scrape-shopee-affiliate/product-page
 * POST /api/app/scrape-shopee-affiliate/export-csv
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  buildCsvSession,
  exportCsvViaCdp,
  fetchProductPageViaCdp,
  getCdpStatus,
  getGemLoginStatus,
  listGemLoginProfiles,
  openAffiliateBrowser,
} from "../../../helpers/shopee-affiliate-scrape";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";

function auth(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
}

export default [
  {
    method: "get",
    path: "/api/app/scrape-shopee-affiliate/gemlogin-status",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const status = await getGemLoginStatus();
        return res.status(200).json({ ok: true, ...status });
      } catch (err: any) {
        return res.status(400).json({ ok: false, message: err?.message || "GemLogin status lỗi" });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/scrape-shopee-affiliate/gemlogin-profiles",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const profiles = await listGemLoginProfiles();
        return res.status(200).json({ ok: true, profiles });
      } catch (err: any) {
        logger.error(`[scrape-shopee] gemlogin-profiles: ${err?.message || err}`);
        return res.status(400).json({
          ok: false,
          message: err?.message || "Không lấy được danh sách profile GemLogin",
        });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/open-browser",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const marketHost = String(req.body?.marketHost || "affiliate.shopee.vn").trim();
        const gemloginProfileId = req.body?.gemloginProfileId
          ? String(req.body.gemloginProfileId).trim()
          : req.body?.profileId
          ? String(req.body.profileId).trim()
          : "";
        const allowChromeFallback = req.body?.allowChromeFallback === true;
        const result = await openAffiliateBrowser({
          marketHost,
          gemloginProfileId: gemloginProfileId || undefined,
          allowChromeFallback,
        });
        logger.info(
          `[scrape-shopee] open-browser source=${result.source} host=${result.marketHost} cdp=${result.cdpEndpoint || ""} profile=${result.gemloginProfileId || ""}`
        );
        return res.status(200).json({ ok: true, ...result });
      } catch (err: any) {
        logger.error(`[scrape-shopee] open-browser: ${err?.message || err}`);
        return res.status(400).json({ ok: false, message: err?.message || "Không mở được trình duyệt" });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/scrape-shopee-affiliate/cdp-status",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const status = await getCdpStatus();
        return res.status(200).json({ ok: true, ...status });
      } catch (err: any) {
        return res.status(400).json({ ok: false, message: err?.message || "CDP status lỗi" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/product-page",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const result = await fetchProductPageViaCdp({
          marketHost: String(req.body?.marketHost || "affiliate.shopee.vn").trim(),
          keyword: req.body?.keyword != null ? String(req.body.keyword) : "",
          sortType: Number(req.body?.sortType),
          pageOffset: Number(req.body?.pageOffset) || 0,
          pageLimit: Number(req.body?.pageLimit) || 20,
          listType: Number.isFinite(Number(req.body?.listType)) ? Number(req.body.listType) : 0,
          filterShopTypes: Array.isArray(req.body?.filterShopTypes)
            ? req.body.filterShopTypes.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
            : undefined,
        });
        return res.status(200).json({ ok: true, ...result });
      } catch (err: any) {
        logger.error(`[scrape-shopee] product-page: ${err?.message || err}`);
        return res.status(400).json({ ok: false, message: err?.message || "Lấy trang sản phẩm thất bại" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/scrape-shopee-affiliate/export-csv",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        auth(req);
        const exported = await exportCsvViaCdp({
          marketHost: String(req.body?.marketHost || "affiliate.shopee.vn").trim(),
          keyword: req.body?.keyword != null ? String(req.body.keyword) : "",
          sortType: Number(req.body?.sortType),
          listType: Number.isFinite(Number(req.body?.listType)) ? Number(req.body.listType) : 0,
          filterShopTypes: Array.isArray(req.body?.filterShopTypes)
            ? req.body.filterShopTypes.map(Number).filter((n: number) => Number.isFinite(n) && n > 0)
            : undefined,
          maxProducts: Number(req.body?.maxProducts) || 500,
          delayMs: Number(req.body?.delayMs) || 400,
          pageLimit: Number(req.body?.pageLimit) || 20,
          withShortLinks: req.body?.withShortLinks !== false,
        });
        const session = buildCsvSession(exported);
        logger.info(
          `[scrape-shopee] export-csv id=${session.id} host=${session.marketHost} count=${session.productCount}`
        );
        return res.status(200).json({ ok: true, session });
      } catch (err: any) {
        logger.error(`[scrape-shopee] export-csv: ${err?.message || err}`);
        return res.status(400).json({ ok: false, message: err?.message || "Xuất CSV thất bại" });
      }
    },
  },
];
