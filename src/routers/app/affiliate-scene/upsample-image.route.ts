/**
 * Route POST upscale ảnh đã generate lên 4K qua Flow2.
 * Client gửi mediaId / projectId / profileId đã lưu khi gen_image thành công.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { upsampleImageWithFlow2 } from "../../api-media/flow2/upsample-image";

function mimeTypeToFileExtension(mimeType?: string, fallback = "jpg"): string {
  if (!mimeType) return fallback;
  const sub = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0]?.toLowerCase();
  if (!sub) return fallback;
  if (sub === "jpeg") return "jpg";
  return sub;
}

export default [
  {
    method: "post",
    path: "/api/app/upsample-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          mediaId?: string;
          projectId?: string;
          profileId?: string;
          fileName?: string;
        };

        const mediaId = body?.mediaId?.trim();
        const projectId = body?.projectId?.trim();
        const profileId = body?.profileId?.trim();

        if (!mediaId || !projectId || !profileId) {
          return res.status(400).json({
            message: "Thiếu mediaId, projectId hoặc profileId để upscale 4K",
          });
        }

        const result = await upsampleImageWithFlow2({ mediaId, projectId, profileId });
        const ext = mimeTypeToFileExtension(result.mimeType, "jpg");
        const downloadName = (body.fileName || `image-4k.${ext}`).replace(/[^\w.\-]+/g, "_");

        const buffer = Buffer.from(result.imageBytes, "base64");
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (err: any) {
        logger.error(`[upsample-image] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale ảnh 4K" });
      }
    },
  },
];
