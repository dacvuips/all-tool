/**
 * POST /api/app/merge-videos/
 * Nối nhiều video (URL http(s) hoặc sẽ mở rộng path) bằng ffmpeg, trả file MP4.
 * Không lưu MinIO — client tự lưu IndexedDB.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { concatVideosToBuffer } from "../../../helpers/ffmpeg";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";

export default [
  {
    method: "post",
    path: "/api/app/merge-videos/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const urls = Array.isArray(req.body?.urls)
          ? (req.body.urls as unknown[])
              .map((u) => String(u || "").trim())
              .filter(Boolean)
          : [];

        if (urls.length < 2) {
          return res.status(400).json({
            message: "Cần ít nhất 2 URL video để nối",
          });
        }
        if (urls.length > 20) {
          return res.status(400).json({ message: "Tối đa 20 video mỗi lần nối" });
        }

        logger.info(`[merge-videos] Nối ${urls.length} video (user ${context.id})`);
        const buffer = await concatVideosToBuffer(urls);

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", String(buffer.length));
        res.setHeader("Content-Disposition", 'inline; filename="merged.mp4"');
        return res.status(200).send(buffer);
      } catch (err: any) {
        logger.error(`[merge-videos] ${err?.message || err}`);
        return res.status(500).json({
          message: err?.message || "Nối video thất bại",
        });
      }
    },
  },
];
