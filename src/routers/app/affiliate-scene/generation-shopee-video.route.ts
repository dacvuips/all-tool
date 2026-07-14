/**
 * Route POST tạo video Shopee (video-affiliate-plus).
 *
 * Payload ảnh (đúng thứ tự):
 *   1. Ảnh nhân vật (character)
 *   2. Ảnh sản phẩm (product)
 *
 * Luôn dùng video_mode = component (Thành phần).
 * variant_count = Số Video / Job (videosPerJob) từ config.
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { FLOW2_VIDEO_MODE } from "../../api-media/flow2/video-mode";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { wakeMediaGenerationQueue } from "../../../queues/media-generation/media-generation.queue";
import { checkVideoLimit } from "./_shared";

function mapVideoModelToQuality(videoModel?: string): string {
  const raw = (videoModel || "").trim();
  if (!raw || raw === "0-credit") return "lite_relaxed";
  if (raw === "fast") return "fast";
  if (raw === "quality") return "quality";
  return raw;
}

export default [
  {
    method: "post",
    path: "/api/app/generation-shopee-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          /** [0]=ảnh nhân vật, [1]=ảnh sản phẩm */
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          characterImage?: string | { imageBytes: string; mimeType?: string };
          productImage?: string | { imageBytes: string; mimeType?: string };
          videosPerJob?: number;
          variantCount?: number;
          videoModel?: string;
          videoQuality?: string;
          config?: {
            prompt?: string;
            aspectRatio?: "16:9" | "9:16";
            videosPerJob?: number;
            variantCount?: number;
            videoModel?: string;
            videoQuality?: string;
            videoMode?: string;
          };
          _metadata?: Record<string, unknown>;
        };

        const prompt = (body.prompt ?? body.config?.prompt ?? "").trim();
        if (!prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        const imagesFromPair = [body.characterImage, body.productImage].filter(
          Boolean
        ) as Array<string | { imageBytes: string; mimeType?: string }>;
        const images =
          imagesFromPair.length > 0
            ? imagesFromPair
            : Array.isArray(body.images)
            ? body.images.filter(Boolean)
            : [];

        if (images.length < 2) {
          return res.status(400).json({
            message: "Cần đúng 2 ảnh: ảnh nhân vật (đầu) và ảnh sản phẩm (sau)",
          });
        }

        const variantCount = Math.max(
          1,
          Math.min(
            5,
            Math.round(
              body.variantCount ??
                body.videosPerJob ??
                body.config?.variantCount ??
                body.config?.videosPerJob ??
                1
            )
          )
        );

        const videoQuality = mapVideoModelToQuality(
          body.videoQuality ||
            body.videoModel ||
            body.config?.videoQuality ||
            body.config?.videoModel
        );

        await checkVideoLimit(context.id);

        const { _metadata, ...rest } = body;
        const requestPayload = {
          ...rest,
          prompt,
          images: images.slice(0, 2),
          video_mode: FLOW2_VIDEO_MODE.COMPONENT,
          variantCount,
          videosPerJob: variantCount,
          videoQuality,
          config: {
            ...body.config,
            prompt,
            aspectRatio: body.config?.aspectRatio || "9:16",
            videoMode: FLOW2_VIDEO_MODE.COMPONENT,
            variantCount,
            videosPerJob: variantCount,
            videoQuality,
          },
        };

        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.GENERATION_SHOPEE_VIDEO,
          requestPayload,
          metadata: { source: "video-affiliate-plus", ..._metadata },
        });

        // Đánh thức consumer nếu Redis reconnect muộn / job kẹt waiting
        try {
          await wakeMediaGenerationQueue();
        } catch (wakeErr: any) {
          logger.warn(
            `[generation-shopee-video] wake queue: ${wakeErr?.message || wakeErr}`
          );
        }

        logger.info(
          `[generation-shopee-video] Enqueued jobId=${jobId} images=${images.length} variant_count=${variantCount} quality=${videoQuality}`
        );

        res.status(202).json({ success: true, jobId, status });
      } catch (err: any) {
        logger.error(`[generation-shopee-video] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
