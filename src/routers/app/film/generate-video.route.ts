/**
 * POST /api/app/film/generate-video/
 *
 * Route riêng Film (tách GENERATION_VIDEO affiliate).
 * Job: `FILM_GENERATION_VIDEO` → Flow2 image/text-to-video.
 *
 * Body chính:
 * - prompt: Prompt video (cảnh quay.videoPrompt)
 * - images[]: theo mode
 *   - Start (image_only / videoMode=frame, 1 ảnh): startImage
 *   - Start-End (start_end / frame, 2 ảnh): startImage + endImage
 *   - Thành phần (start_add_end / component, 1–3 ảnh): reference components
 * - serviceImageType: image_only | start_end | start_add_end
 * - videoMode: frame | component (fallback khi thiếu serviceImageType)
 * - aspectRatio, filmProjectId, filmEpisodeId, filmSceneId
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import {
  buildFilmJobMetadata,
  type FilmMediaAssetKind,
} from "../../../queues/media-generation/handlers/film-job.types";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { checkVideoLimit } from "../affiliate-scene/_shared";

export default [
  {
    method: "post",
    path: "/api/app/film/generate-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          aspectRatio?: "16:9" | "9:16";
          videoMode?: string;
          serviceImageType?: string;
          generateAudio?: boolean;
          noText?: boolean;
          filmProjectId?: string;
          filmEpisodeId?: string;
          filmSceneId?: string;
          filmAssetKind?: FilmMediaAssetKind;
          _metadata?: Record<string, unknown>;
        };

        const prompt = String(body?.prompt || "").trim();
        if (!prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkVideoLimit(context.id);

        const filmMeta = buildFilmJobMetadata({
          filmProjectId: body.filmProjectId,
          filmEpisodeId: body.filmEpisodeId,
          filmSceneId: body.filmSceneId,
          filmAssetKind: body.filmAssetKind || "shot_video",
        });

        const requestPayload = {
          filmSource: "film" as const,
          prompt,
          images: body.images,
          aspectRatio: body.aspectRatio || "9:16",
          videoMode: body.videoMode,
          serviceImageType: body.serviceImageType,
          generateAudio: body.generateAudio,
          noText: body.noText === true,
          filmProjectId: body.filmProjectId,
          filmEpisodeId: body.filmEpisodeId,
          filmSceneId: body.filmSceneId,
          filmAssetKind: body.filmAssetKind || "shot_video",
        };

        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.FILM_GENERATION_VIDEO,
          requestPayload,
          metadata: {
            ...filmMeta,
            ...(body._metadata || {}),
            module: "film",
          },
        });

        res.status(202).json({
          success: true,
          jobId,
          status,
          type: MediaGenerationJobType.FILM_GENERATION_VIDEO,
        });
      } catch (err: any) {
        logger.error(`[film-generate-video] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
