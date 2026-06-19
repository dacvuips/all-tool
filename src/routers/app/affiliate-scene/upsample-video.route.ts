/**
 * Route POST upscale video đã generate lên 1080p qua Flow2.
 * Cần flow2RequestId (request_id từ gen_text_video / gen_image_video).
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { upsampleVideoWithFlow2 } from "../../api-media/flow2/upsample-video";
import { Context } from "../../../libs/graphql";

function mimeTypeToFileExtension(mimeType?: string, fallback = "mp4"): string {
  if (!mimeType) return fallback;
  const sub = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0]?.toLowerCase();
  if (!sub) return fallback;
  if (sub === "quicktime") return "mov";
  return sub;
}

export default [
  {
    method: "post",
    path: "/api/app/upsample-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          flow2RequestId?: string;
          fileName?: string;
        };

        const flow2RequestId = body?.flow2RequestId?.trim();
        if (!flow2RequestId) {
          return res.status(400).json({
            message: "Thiếu flow2RequestId để upscale video 1080p",
          });
        }

        const result = await upsampleVideoWithFlow2({ flow2RequestId });

        const ext = mimeTypeToFileExtension(result.mimeType, "mp4");
        const defaultName = `video-1080p.${ext}`;
        const downloadName = (body.fileName || defaultName).replace(/[^\w.\-]+/g, "_");

        const buffer = Buffer.from(result.videoBytes, "base64");
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (err: any) {
        logger.error(`[upsample-video] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale video 1080p" });
      }
    },
  },
];
