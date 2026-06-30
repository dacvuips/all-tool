/**
 * Route POST upscale ảnh đã generate lên 2K/4K qua Flow2.
 * Cần flow2RequestId (request_id từ gen_image) + resolution.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import {
  upsampleImageWithFlow2,
  UpsampleResolution,
} from "../../api-media/flow2/upsample-image";
import { Context } from "../../../libs/graphql";
import { assertCustomerMediaGenerationAllowed } from "./_shared";

function mimeTypeToFileExtension(mimeType?: string, fallback = "jpg"): string {
  if (!mimeType) return fallback;
  const sub = mimeType.split("/")[1]?.split(";")[0]?.split("+")[0]?.toLowerCase();
  if (!sub) return fallback;
  if (sub === "jpeg") return "jpg";
  return sub;
}

function parseResolution(value: unknown): UpsampleResolution {
  const normalized = String(value || "4K").toUpperCase();
  return normalized === "2K" ? "2K" : "4K";
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
          resolution?: UpsampleResolution | string;
          flow2RequestId?: string;
          fileName?: string;
        };

        const resolution = parseResolution(body?.resolution);
        const flow2RequestId = body?.flow2RequestId?.trim();

        if (!flow2RequestId) {
          return res.status(400).json({
            message: "Thiếu flow2RequestId để upscale ảnh",
          });
        }

        await assertCustomerMediaGenerationAllowed(context.id);

        const result = await upsampleImageWithFlow2({ resolution, flow2RequestId });

        const ext = mimeTypeToFileExtension(result.mimeType, "jpg");
        const defaultName = `image-${resolution.toLowerCase()}.${ext}`;
        const downloadName = (body.fileName || defaultName).replace(/[^\w.\-]+/g, "_");

        const buffer = Buffer.from(result.imageBytes, "base64");
        res.setHeader("Content-Type", result.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (err: any) {
        logger.error(`[upsample-image] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale ảnh" });
      }
    },
  },
];
