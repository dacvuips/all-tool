/**
 * Check 24h + signer config/balance.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { shopeeUploadConfig } from "../../../shopee-video-upload/config";
import { check24hPosts } from "../../../shopee-video-upload/shopee/api";
import { signerClient } from "../../../shopee-video-upload/signer/signer.client";
import { getSignerAdapter } from "../../../shopee-video-upload/signer/get-adapter";

function auth(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
}

export default [
  {
    method: "post",
    path: "/api/app/shopee-video-upload/check-24h",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      const cookie = String(req.body?.cookie || "").trim();
      const country = req.body?.country;
      const proxy = req.body?.proxy;
      const username = req.body?.username || "";

      if (!cookie) {
        return res.json({
          success: false,
          error: "Thiếu cookie",
          username,
        });
      }

      if (shopeeUploadConfig.dryRun) {
        return res.json({
          success: true,
          username,
          count24h: 0,
          canPost: true,
          dryRun: true,
        });
      }

      try {
        const result = await check24hPosts({ cookie, country, proxy });
        res.json({
          success: true,
          username,
          count24h: result.count24h,
          canPost: result.canPost,
        });
      } catch (err: any) {
        const msg = err?.message || "Lỗi check 24h";
        const banned =
          /hạn chế|khóa|ban|expired|hết hạn/i.test(msg);
        res.json({
          success: false,
          username,
          error: msg,
          banned,
        });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/shopee-video-upload/signer/config",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      res.json({
        success: true,
        signerBaseUrl: shopeeUploadConfig.signerBaseUrl,
        adapter: shopeeUploadConfig.signerAdapter,
        dryRun: shopeeUploadConfig.dryRun,
        // không trả full API key
        apiKeySet: Boolean(shopeeUploadConfig.signerApiKey),
      });
    },
  },
  {
    method: "get",
    path: "/api/app/shopee-video-upload/signer/balance",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      try {
        // Ưu tiên gọi qua HTTP client (giống MLS); fallback adapter trực tiếp
        let result;
        try {
          result = await signerClient.me();
        } catch {
          result = await getSignerAdapter().me();
        }
        if (result.code === 0 && result.data) {
          return res.json({
            success: true,
            username: result.data.username,
            credits: result.data.credits,
            is_active: result.data.is_active,
            adapter: shopeeUploadConfig.signerAdapter,
          });
        }
        res.json({
          success: false,
          error: result.message || "Không lấy được số dư",
        });
      } catch (err: any) {
        res.json({ success: false, error: err?.message || "Lỗi kết nối signer" });
      }
    },
  },
];
