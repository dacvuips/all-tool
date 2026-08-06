/**
 * POST /api/app/clean-watermark/
 * Xóa logo / watermark ảnh & video qua Flow2 (sync base64).
 *
 * Kiểm tra mỗi request:
 * 1) Token đăng nhập (Context.auth)
 * 2) Customer tồn tại + status ACTIVE + sàn không bị block
 * 3) Gói Basic+ — chặn FREE/TRIAL
 * 4) Hạn mức ảnh/video còn slot (đọc lại DB trước mỗi item)
 * 5) Chỉ $inc imageCount/videoCount khi item thành công có media_base64
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  assertCustomerMediaGenerationAllowed,
  assertPaidPackageForWatermark,
  getImageVideoQuotaRemaining,
  incrementImageCount,
  incrementVideoCount,
} from "./_shared";
import {
  cleanWatermarkViaFlow2,
  CleanWatermarkKind,
  validateMediaPayload,
  WATERMARK_IMAGE_MAX_BYTES,
  WATERMARK_VIDEO_MAX_BYTES,
} from "./_clean-watermark";

type CleanWatermarkItemInput = {
  clientId?: string;
  kind: CleanWatermarkKind;
  mediaBase64: string;
  mimeType?: string;
  name?: string;
};

type ProcessedItem = {
  clientId?: string;
  name?: string;
  success: true;
  kind: CleanWatermarkKind;
  mimeType: string;
  mediaBase64: string;
  url?: string;
  requestId?: string;
  elapsedSeconds?: number;
  originalByteLength: number;
};

type SkippedItem = {
  clientId?: string;
  name?: string;
  kind: CleanWatermarkKind;
  success: false;
  reason: string;
  code: "QUOTA_EXCEEDED" | "VALIDATION" | "API_ERROR";
};

function normalizeKind(value: unknown): CleanWatermarkKind | null {
  const k = String(value || "").toLowerCase();
  if (k === "image" || k === "video") return k;
  return null;
}

export default [
  {
    method: "post",
    path: "/api/app/clean-watermark/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        // 1) Auth
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        if (!context.id) {
          return res.status(401).json({ message: "Chưa đăng nhập" });
        }

        // 2) Customer tồn tại / ACTIVE / sàn không block
        await assertCustomerMediaGenerationAllowed(context.id);
        // 3) Gói Basic trở lên
        await assertPaidPackageForWatermark(context.id);

        const body = req.body as {
          items?: CleanWatermarkItemInput[];
          kind?: CleanWatermarkKind;
          mediaBase64?: string;
          mimeType?: string;
          name?: string;
          clientId?: string;
          returnMode?: "base64" | "url" | "both";
        };

        let items: CleanWatermarkItemInput[] = Array.isArray(body?.items) ? body.items : [];
        if (!items.length && body?.mediaBase64) {
          const kind = normalizeKind(body.kind) || "image";
          items = [
            {
              clientId: body.clientId,
              kind,
              mediaBase64: body.mediaBase64,
              mimeType: body.mimeType,
              name: body.name,
            },
          ];
        }

        if (!items.length) {
          return res.status(400).json({ message: "Vui lòng gửi ít nhất 1 ảnh hoặc video" });
        }

        if (items.length > 30) {
          return res.status(400).json({ message: "Tối đa 30 file mỗi lần yêu cầu" });
        }

        const processed: ProcessedItem[] = [];
        const skipped: SkippedItem[] = [];
        let imagesUsed = 0;
        let videosUsed = 0;

        for (const raw of items) {
          const kind = normalizeKind(raw?.kind);
          const clientId = raw?.clientId;
          const name = raw?.name;

          if (!kind) {
            skipped.push({
              clientId,
              name,
              kind: "image",
              success: false,
              reason: "Loại media không hợp lệ (image|video)",
              code: "VALIDATION",
            });
            continue;
          }

          // 4) Đọc lại hạn mức từ DB trước mỗi item
          const quotaLive = await getImageVideoQuotaRemaining(context.id);
          const remaining =
            kind === "image" ? quotaLive.imageRemaining : quotaLive.videoRemaining;

          if (remaining <= 0) {
            skipped.push({
              clientId,
              name,
              kind,
              success: false,
              reason:
                kind === "image"
                  ? `Hết hạn mức ảnh (${quotaLive.imageCount}/${quotaLive.imageLimit}). Vui lòng nâng cấp gói hoặc chờ reset hạn mức vào ngày mai.`
                  : `Hết hạn mức video (${quotaLive.videoCount}/${quotaLive.videoLimit}). Vui lòng nâng cấp gói hoặc chờ reset hạn mức vào ngày mai.`,
              code: "QUOTA_EXCEEDED",
            });
            continue;
          }

          let validated: ReturnType<typeof validateMediaPayload>;
          try {
            validated = validateMediaPayload({
              kind,
              base64: raw.mediaBase64,
              mimeType: raw.mimeType,
            });
          } catch (err: any) {
            skipped.push({
              clientId,
              name,
              kind,
              success: false,
              reason: err?.message || "File không hợp lệ",
              code: "VALIDATION",
            });
            continue;
          }

          try {
            const result = await cleanWatermarkViaFlow2({
              kind,
              dataUrl: validated.dataUrl,
              returnMode: body.returnMode || "both",
            });

            const mediaBase64 = (result.media_base64 || "").trim();
            if (!mediaBase64) {
              skipped.push({
                clientId,
                name,
                kind,
                success: false,
                reason: "API không trả về media đã xử lý",
                code: "API_ERROR",
              });
              continue;
            }

            // 5) Trừ lượt ngay sau khi thành công
            if (kind === "image") {
              await incrementImageCount(context.id, 1);
              imagesUsed += 1;
            } else {
              await incrementVideoCount(context.id, 1);
              videosUsed += 1;
            }

            processed.push({
              clientId,
              name,
              success: true,
              kind: result.kind || kind,
              mimeType: result.mime_type || validated.mimeType,
              mediaBase64,
              url: result.url || result.Link,
              requestId: result.request_id,
              elapsedSeconds: result.elapsed_seconds,
              originalByteLength: validated.byteLength,
            });
          } catch (err: any) {
            logger.error(
              `[clean-watermark] item lỗi (${kind}/${name || clientId}): ${err?.message}`
            );
            skipped.push({
              clientId,
              name,
              kind,
              success: false,
              reason: err?.message || "Lỗi khi xóa watermark",
              code: "API_ERROR",
            });
          }
        }

        // 1 file + hết quota → 403 rõ ràng
        if (
          items.length === 1 &&
          processed.length === 0 &&
          skipped.length === 1 &&
          skipped[0].code === "QUOTA_EXCEEDED"
        ) {
          return res.status(403).json({
            message: skipped[0].reason,
            code: "QUOTA_EXCEEDED",
            success: false,
            processed,
            skipped,
          });
        }

        const quotaAfter = await getImageVideoQuotaRemaining(context.id);

        return res.status(200).json({
          success: true,
          processed,
          skipped,
          summary: {
            total: items.length,
            successCount: processed.length,
            skippedCount: skipped.length,
            imagesUsed,
            videosUsed,
            imageQuotaExceeded: skipped.filter(
              (s) => s.kind === "image" && s.code === "QUOTA_EXCEEDED"
            ).length,
            videoQuotaExceeded: skipped.filter(
              (s) => s.kind === "video" && s.code === "QUOTA_EXCEEDED"
            ).length,
          },
          limits: {
            imageMaxBytes: WATERMARK_IMAGE_MAX_BYTES,
            videoMaxBytes: WATERMARK_VIDEO_MAX_BYTES,
          },
          quota: {
            imageCount: quotaAfter.imageCount,
            imageLimit: quotaAfter.imageLimit,
            imageRemaining: quotaAfter.imageRemaining,
            videoCount: quotaAfter.videoCount,
            videoLimit: quotaAfter.videoLimit,
            videoRemaining: quotaAfter.videoRemaining,
          },
        });
      } catch (err: any) {
        logger.error(`[clean-watermark] ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi xóa watermark" });
      }
    },
  },
];
