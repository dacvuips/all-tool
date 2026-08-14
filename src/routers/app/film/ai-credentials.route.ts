/**
 * GET  /api/app/film/ai-credentials/  — status (không trả plaintext key)
 * PUT  /api/app/film/ai-credentials/  — lưu key vào Credential (encrypt)
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  filmCustomerId,
  getFilmAiCredentialStatus,
  saveFilmAiCredentials,
} from "./_film-ai-credentials";

export default [
  {
    method: "get",
    path: "/api/app/film/ai-credentials/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const status = await getFilmAiCredentialStatus(filmCustomerId(context));
        res.json({ success: true, data: status });
      } catch (err: any) {
        logger.error(`[film-ai-credentials] GET: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "put",
    path: "/api/app/film/ai-credentials/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        const body = (req.body || {}) as {
          openaiKey?: string;
          geminiKey?: string;
          gatewayEndpoint?: string;
          gatewayApiKey?: string;
          gatewayModel?: string;
        };
        const status = await saveFilmAiCredentials(context, body);
        res.json({ success: true, data: status });
      } catch (err: any) {
        logger.error(`[film-ai-credentials] PUT: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
