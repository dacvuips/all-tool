/**
 * Check 24h + signer config/balance.
 * Signer Base URL + API Key lấy từ Admin Settings (không từ Cài đặt customer).
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { resolveEffectiveSignerCreds } from "../../../shopee-video-upload/admin-signer-creds";
import { shopeeUploadConfig } from "../../../shopee-video-upload/config";
import { check24hPosts } from "../../../shopee-video-upload/shopee/api";
import { NativeSignerAdapter } from "../../../shopee-video-upload/signer/adapters/native.signer";
import { withSignerCreds } from "../../../shopee-video-upload/signer/creds-context";
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
        const banned = /hạn chế|khóa|ban|expired|hết hạn/i.test(msg);
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
      const creds = await resolveEffectiveSignerCreds();
      res.json({
        success: true,
        signerBaseUrl: creds.baseUrl,
        source: creds.source,
        adapter: shopeeUploadConfig.signerAdapter,
        dryRun: shopeeUploadConfig.dryRun,
        apiKeySet: Boolean(creds.apiKey),
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
        const creds = await resolveEffectiveSignerCreds();
        const result = await withSignerCreds(
          { baseUrl: creds.baseUrl, apiKey: creds.apiKey },
          async () => {
            if (shopeeUploadConfig.signerAdapter === "native" || creds.apiKey) {
              return new NativeSignerAdapter({
                baseUrl: creds.baseUrl,
                apiKey: creds.apiKey,
              }).me();
            }
            return getSignerAdapter().me();
          }
        );
        if (result.code === 0 && result.data) {
          return res.json({
            success: true,
            username: result.data.username,
            credits: result.data.credits,
            is_active: result.data.is_active,
            adapter: shopeeUploadConfig.signerAdapter,
            signerBaseUrl: creds.baseUrl,
            source: creds.source,
          });
        }
        res.json({
          success: false,
          error: result.message || `Không lấy được số dư (code=${result.code})`,
          code: result.code,
          signerBaseUrl: creds.baseUrl,
        });
      } catch (err: any) {
        res.json({ success: false, error: err?.message || "Lỗi kết nối signer" });
      }
    },
  },
  {
    /** Admin Settings: check balance với Base URL + API Key đang nhập */
    method: "post",
    path: "/api/app/shopee-video-upload/signer/balance",
    midd: [],
    action: async (req: Request, res: Response) => {
      auth(req);
      const override = {
        baseUrl: String(req.body?.signerBaseUrl || req.body?.baseUrl || "").trim() || undefined,
        meBaseUrl:
          String(req.body?.signerMeBaseUrl || req.body?.meBaseUrl || "").trim() || undefined,
        apiKey: String(req.body?.signerApiKey || req.body?.apiKey || "").trim() || undefined,
      };
      try {
        const creds = await resolveEffectiveSignerCreds(override);
        if (!creds.apiKey) {
          return res.json({
            success: false,
            error: "Thiếu API Key — nhập shopee-signer-api-key rồi thử lại",
          });
        }
        if (!creds.baseUrl && !override.meBaseUrl) {
          return res.json({
            success: false,
            error: "Thiếu Base URL — nhập shopee-signer-base-url",
          });
        }
        const result = await withSignerCreds(
          {
            baseUrl: creds.baseUrl || override.meBaseUrl,
            meBaseUrl: override.meBaseUrl,
            apiKey: creds.apiKey,
          },
          async () =>
            new NativeSignerAdapter({
              baseUrl: creds.baseUrl || override.meBaseUrl,
              meBaseUrl: override.meBaseUrl,
              apiKey: creds.apiKey,
            }).me()
        );
        if (result.code === 0 && result.data) {
          return res.json({
            success: true,
            username: result.data.username,
            credits: result.data.credits,
            is_active: result.data.is_active,
            adapter: shopeeUploadConfig.signerAdapter,
            signerBaseUrl: creds.baseUrl,
            source: creds.source,
          });
        }
        res.json({
          success: false,
          error: result.message || `Không lấy được số dư (code=${result.code})`,
          code: result.code,
          signerBaseUrl: creds.baseUrl,
        });
      } catch (err: any) {
        res.json({ success: false, error: err?.message || "Lỗi kết nối signer" });
      }
    },
  },
];
