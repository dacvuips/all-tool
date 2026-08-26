/**
 * POST /api/app/audio-to-video/
 * phase: "transcribe" | "analyze" (default transcribe)
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { handleSourceToVideoRequest } from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/audio-to-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
        await handleSourceToVideoRequest("audio", req, res, context.id);
      } catch (err: any) {
        logger.error(`[audio-to-video] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
