/**
 * Route POST upscale video đã generate lên 1080p qua Flow2 (SSE stream).
 * GET download — tải blob ngắn qua token Redis (tránh 504 gateway timeout).
 * Cần flow2RequestId (request_id từ gen_text_video / gen_image_video).
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { upsampleVideoWithFlow2 } from "../../api-media/flow2/upsample-video";
import {
  initGenerationSSE,
  sendGenerationSSEError,
} from "../../api-media/generation-sse";
import { Context } from "../../../libs/graphql";
import {
  createUpsampleVideoDownloadToken,
  deleteUpsampleVideoTemp,
  loadUpsampleVideoTemp,
  saveUpsampleVideoTemp,
} from "./_upsample-video-temp";

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
      let sseStarted = false;
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

        const send = initGenerationSSE(res);
        sseStarted = true;
        send({ type: "progress", progress: 5, message: "Đang bắt đầu upscale 1080p..." });

        const result = await upsampleVideoWithFlow2({
          flow2RequestId,
          onProgress: async (progress, message) => {
            send({
              type: "progress",
              progress,
              message: message || "Đang upscale video 1080p...",
            });
          },
        });

        const ext = mimeTypeToFileExtension(result.mimeType, "mp4");
        const defaultName = `video-1080p.${ext}`;
        const downloadName = (body.fileName || defaultName).replace(/[^\w.\-]+/g, "_");

        send({ type: "progress", progress: 96, message: "Đang chuẩn bị tải xuống..." });

        const downloadToken = createUpsampleVideoDownloadToken();
        await saveUpsampleVideoTemp(downloadToken, {
          videoBytes: result.videoBytes,
          mimeType: result.mimeType,
          customerId: context.id,
          fileName: downloadName,
        });

        send({
          type: "done",
          progress: 100,
          message: "Hoàn tất upscale 1080p",
          downloadToken,
          mimeType: result.mimeType,
          fileName: downloadName,
        });
        res.end();
      } catch (err: any) {
        logger.error(`[upsample-video] Lỗi: ${err?.message}`);
        if (sseStarted) {
          sendGenerationSSEError(
            res,
            err?.message || "Lỗi upscale video 1080p",
            err?.statusCode || 500
          );
          return;
        }
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale video 1080p" });
      }
    },
  },
  {
    method: "get",
    path: "/api/app/upsample-video/download/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const token = String(req.query.token || "").trim();
        if (!token) {
          return res.status(400).json({ message: "Thiếu token tải video 1080p" });
        }

        const payload = await loadUpsampleVideoTemp(token, context.id);
        if (!payload) {
          return res.status(404).json({
            message: "Link tải video không hợp lệ hoặc đã hết hạn",
          });
        }

        const buffer = Buffer.from(payload.videoBytes, "base64");
        const downloadName = payload.fileName || "video-1080p.mp4";

        await deleteUpsampleVideoTemp(token);

        res.setHeader("Content-Type", payload.mimeType);
        res.setHeader("Content-Disposition", `attachment; filename="${downloadName}"`);
        res.setHeader("Content-Length", String(buffer.length));
        res.send(buffer);
      } catch (err: any) {
        logger.error(`[upsample-video-download] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi tải video 1080p" });
      }
    },
  },
];
