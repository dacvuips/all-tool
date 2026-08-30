/**
 * Facebook OAuth — Kết nối Fanpage tự động.
 *
 * GET  /api/app/facebook-oauth/start    — trả authUrl (cần đăng nhập customer)
 * GET  /api/app/facebook-oauth/callback — Facebook redirect về đây
 * GET  /api/app/facebook-oauth/pages    — danh sách Fanpage (sau OAuth)
 * POST /api/app/facebook-oauth/connect  — lưu Page token đã chọn
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { renderFacebookOAuthCallbackHtml } from "../../../facebook-oauth/callback-html";
import { buildFacebookOAuthUrl, isFacebookOAuthAvailable } from "../../../facebook-oauth/config";
import { saveFacebookPageCredential } from "../../../facebook-oauth/save-facebook-credential";
import {
  consumeOAuthState,
  createConnectSessionId,
  createOAuthState,
  deleteConnectSession,
  getConnectSession,
  saveConnectSession,
  saveOAuthState,
} from "../../../facebook-oauth/session";
import {
  exchangeCodeForUserToken,
  exchangeLongLivedUserToken,
  fetchManagedPages,
} from "../../../facebook-oauth/service";
import { Context } from "../../../libs/graphql";

function requireCustomer(context: Context): string {
  context.auth([TOKEN_ROLES.CUSTOMER]);
  const customerId = String(context.customerId || context.id || "").trim();
  if (!customerId) {
    const err: any = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }
  return customerId;
}

export default [
  {
    method: "get",
    path: "/api/app/facebook-oauth/status",
    midd: [],
    action: async (_req: Request, res: Response) => {
      res.json({ success: true, available: isFacebookOAuthAvailable() });
    },
  },
  {
    method: "get",
    path: "/api/app/facebook-oauth/start",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req, res });
        const customerId = requireCustomer(context);
        const state = createOAuthState();
        await saveOAuthState(state, customerId);
        const authUrl = buildFacebookOAuthUrl(state);
        res.json({ success: true, authUrl });
      } catch (err: any) {
        logger.error(`[facebook-oauth] start: ${err?.message}`);
        res.status(err?.statusCode || 500).json({
          success: false,
          message: err?.message || "Không thể bắt đầu kết nối Facebook",
        });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/facebook-oauth/callback",
    midd: [],
    action: async (req: Request, res: Response) => {
      const error = String(req.query.error || "").trim();
      const errorDescription = String(req.query.error_description || "").trim();
      const code = String(req.query.code || "").trim();
      const state = String(req.query.state || "").trim();

      const fail = (message: string) => {
        res
          .status(200)
          .type("html")
          .send(renderFacebookOAuthCallbackHtml({ status: "error", message }));
      };

      if (error) {
        return fail(errorDescription || error || "Người dùng hủy kết nối Facebook");
      }
      if (!code || !state) {
        return fail("Thiếu code hoặc state từ Facebook");
      }

      try {
        const customerId = await consumeOAuthState(state);
        if (!customerId) {
          return fail("Phiên OAuth hết hạn — thử kết nối lại");
        }

        const shortToken = await exchangeCodeForUserToken(code);
        const userToken = await exchangeLongLivedUserToken(shortToken);
        const pages = await fetchManagedPages(userToken);

        if (pages.length === 0) {
          return fail(
            "Không tìm thấy Fanpage nào — hãy đảm bảo tài khoản có quyền quản lý Fanpage"
          );
        }

        const connectSessionId = createConnectSessionId();
        await saveConnectSession(connectSessionId, {
          customerId,
          pages,
          createdAt: Date.now(),
        });

        res
          .status(200)
          .type("html")
          .send(
            renderFacebookOAuthCallbackHtml({
              status: "success",
              connectSessionId,
            })
          );
      } catch (err: any) {
        logger.error(`[facebook-oauth] callback: ${err?.message}`);
        fail(err?.message || "Không thể hoàn tất kết nối Facebook");
      }
    },
  },
  {
    method: "get",
    path: "/api/app/facebook-oauth/pages",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req, res });
        const customerId = requireCustomer(context);
        const sessionId = String(req.query.session || "").trim();
        if (!sessionId) {
          res.status(400).json({ success: false, message: "Thiếu session" });
          return;
        }

        const session = await getConnectSession(sessionId);
        if (!session || session.customerId !== customerId) {
          res.status(404).json({ success: false, message: "Phiên kết nối hết hạn — thử lại" });
          return;
        }

        res.json({
          success: true,
          pages: session.pages.map((p) => ({
            id: p.id,
            name: p.name,
            pictureUrl: p.pictureUrl || null,
          })),
        });
      } catch (err: any) {
        logger.error(`[facebook-oauth] pages: ${err?.message}`);
        res.status(err?.statusCode || 500).json({
          success: false,
          message: err?.message || "Không thể tải danh sách Fanpage",
        });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/facebook-oauth/connect",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req, res });
        const customerId = requireCustomer(context);
        const sessionId = String(req.body?.sessionId || "").trim();
        const pageId = String(req.body?.pageId || "").trim();

        if (!sessionId || !pageId) {
          res.status(400).json({ success: false, message: "Thiếu sessionId hoặc pageId" });
          return;
        }

        const session = await getConnectSession(sessionId);
        if (!session || session.customerId !== customerId) {
          res.status(404).json({ success: false, message: "Phiên kết nối hết hạn — thử lại" });
          return;
        }

        const page = session.pages.find((p) => p.id === pageId);
        if (!page) {
          res.status(404).json({ success: false, message: "Không tìm thấy Fanpage đã chọn" });
          return;
        }

        await saveFacebookPageCredential(context, page.accessToken);
        await deleteConnectSession(sessionId);

        res.json({
          success: true,
          page: { id: page.id, name: page.name },
        });
      } catch (err: any) {
        logger.error(`[facebook-oauth] connect: ${err?.message}`);
        res.status(err?.statusCode || 500).json({
          success: false,
          message: err?.message || "Không thể lưu kết nối Facebook",
        });
      }
    },
  },
];
