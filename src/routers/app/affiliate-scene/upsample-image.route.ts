/**
 * Route POST upscale ảnh đã generate lên 2K/4K qua Flow2 (SSE stream).
 * GET download — tải blob ngắn qua token Redis (tránh 502/504 gateway timeout).
 * Cần flow2RequestId (request_id từ gen_image) + resolution.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import {
  upsampleImageWithFlow2,
  UpsampleResolution,
} from "../../api-media/flow2/upsample-image";
import { fetchFlow2UpsampleMediaBytes } from "../../api-media/flow2/upsample-poll";
import {
  initGenerationSSE,
  sendGenerationSSEError,
} from "../../api-media/generation-sse";
import { Context } from "../../../libs/graphql";
import {
  assertCustomerMediaGenerationAllowed,
  checkImageLimit,
  incrementImageCount,
} from "./_shared";
import {
  createUpsampleImageDownloadToken,
  deleteUpsampleImageTemp,
  loadUpsampleImageTemp,
  saveUpsampleImageTemp,
} from "./_upsample-image-temp";

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
      let sseStarted = false;
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
        await checkImageLimit(context.id);

        const send = initGenerationSSE(res);
        sseStarted = true;
        send({
          type: "progress",
          progress: 5,
          message: `Đang bắt đầu upscale ${resolution}...`,
        });

        const result = await upsampleImageWithFlow2({
          resolution,
          flow2RequestId,
          onProgress: async (progress, message) => {
            send({
              type: "progress",
              progress,
              message: message || `Đang upscale ảnh ${resolution}...`,
            });
          },
        });

        const ext = mimeTypeToFileExtension(result.mimeType, "jpg");
        const defaultName = `image-${resolution.toLowerCase()}.${ext}`;
        const downloadName = (body.fileName || defaultName).replace(/[^\w.\-]+/g, "_");

        send({ type: "progress", progress: 96, message: "Đang chuẩn bị tải xuống..." });

        let imageBytes = (result.imageBytes || "").trim();
        let mimeType = result.mimeType;
        let imageUrl = result.imageUrl || "";

        if (!imageBytes) {
          const downloaded = await fetchFlow2UpsampleMediaBytes({
            url: result.imageUrl,
            jobId: result.upsampleJobId,
            kind: "image",
          });
          imageBytes = downloaded.buffer.toString("base64");
          mimeType = downloaded.mimeType || result.mimeType;
          imageUrl = downloaded.finalUrl || result.imageUrl;
        }

        if (!imageBytes.length) {
          throw Object.assign(new Error("Ảnh upscale trả về rỗng"), { statusCode: 502 });
        }

        // Chỉ trừ lượt sau khi có file thành công — tránh trừ oan khi URL lỗi
        await incrementImageCount(context.id);

        const downloadToken = createUpsampleImageDownloadToken();
        await saveUpsampleImageTemp(downloadToken, {
          imageBytes,
          mimeType,
          customerId: context.id,
          fileName: downloadName,
        });

        send({
          type: "done",
          progress: 100,
          message: `Hoàn tất upscale ${resolution}`,
          downloadToken,
          mimeType,
          fileName: downloadName,
          imageUrl: imageUrl || undefined,
        });
        res.end();
      } catch (err: any) {
        logger.error(`[upsample-image] Lỗi: ${err?.message}`);
        if (sseStarted) {
          sendGenerationSSEError(
            res,
            err?.message || "Lỗi upscale ảnh",
            err?.statusCode || 500
          );
          return;
        }
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale ảnh" });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/upsample-image/download/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const token = String(req.query.token || "").trim();
        if (!token) {
          return res.status(400).json({ message: "Thiếu token tải ảnh upscale" });
        }

        const payload = await loadUpsampleImageTemp(token, context.id);
        if (!payload) {
          return res.status(404).json({
            message: "Link tải ảnh không hợp lệ hoặc đã hết hạn",
          });
        }

        const buffer = Buffer.from(payload.imageBytes, "base64");
        const downloadName = payload.fileName || "image-upscale.jpg";

        await deleteUpsampleImageTemp(token);

        res.setHeader("Content-Type", payload.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (err: any) {
        logger.error(`[upsample-image-download] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi tải ảnh upscale" });
      }
    },
  },
];
