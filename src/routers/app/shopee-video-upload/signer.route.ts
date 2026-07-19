/**
 * Internal signer routes — tương thích credit.toolshopee.vn.
 * POST /api/internal/shopee-signer/sign
 * POST /api/internal/shopee-signer/generate-token
 * GET  /api/internal/shopee-signer/me
 */
import { Request, Response } from "express";
import { shopeeUploadConfig } from "../../../shopee-video-upload/config";
import { getSignerAdapter } from "../../../shopee-video-upload/signer/get-adapter";

function checkApiKey(req: Request, res: Response): boolean {
  const key = String(req.header("X-API-Key") || "").trim();
  if (!key || key !== shopeeUploadConfig.signerApiKey) {
    res.status(401).json({ code: 401, message: "API Key không hợp lệ" });
    return false;
  }
  return true;
}

export default [
  {
    method: "post",
    path: "/api/internal/shopee-signer/sign",
    midd: [],
    action: async (req: Request, res: Response) => {
      if (!checkApiKey(req, res)) return;
      const adapter = getSignerAdapter();
      const result = await adapter.sign({
        url: req.body?.url,
        body: req.body?.body,
        cookie: req.body?.cookie,
        country: req.body?.country,
        proxy: req.body?.proxy,
      });
      const http = result.code === 0 ? 200 : result.code === 501 ? 501 : 400;
      res.status(http).json(result);
    },
  },
  {
    method: "post",
    path: "/api/internal/shopee-signer/generate-token",
    midd: [],
    action: async (req: Request, res: Response) => {
      if (!checkApiKey(req, res)) return;
      const adapter = getSignerAdapter();
      const result = await adapter.generateToken({
        cookie: req.body?.cookie,
        country: req.body?.country,
      });
      const http = result.code === 0 ? 200 : result.code === 501 ? 501 : 400;
      res.status(http).json(result);
    },
  },
  {
    method: "get",
    path: "/api/internal/shopee-signer/me",
    midd: [],
    action: async (req: Request, res: Response) => {
      if (!checkApiKey(req, res)) return;
      const adapter = getSignerAdapter();
      const result = await adapter.me();
      res.status(result.code === 0 ? 200 : 400).json(result);
    },
  },
];
