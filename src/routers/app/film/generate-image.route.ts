/**
 * POST /api/app/film/generate-image/
 * Film short-project — enqueue job `FILM_GENERATION_IMAGE` (tách biệt GENERATION_IMAGE).
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
import { checkImageLimit } from "../affiliate-scene/_shared";

export default [
  {
    method: "post",
    path: "/api/app/film/generate-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          aspectRatio?: "16:9" | "9:16";
          numberOfImages?: number;
          imageModel?: string;
          noText?: boolean;
          filmProjectId?: string;
          filmEpisodeId?: string;
          filmSceneId?: string;
          filmCharacterId?: string;
          filmPropId?: string;
          filmSceneImageId?: string;
          filmAssetKind?: FilmMediaAssetKind;
          _metadata?: Record<string, unknown>;
        };

        const prompt = String(body?.prompt || "").trim();
        if (!prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
        }

        await checkImageLimit(context.id);

        const filmMeta = buildFilmJobMetadata({
          filmProjectId: body.filmProjectId,
          filmEpisodeId: body.filmEpisodeId,
          filmSceneId: body.filmSceneId,
          filmCharacterId: body.filmCharacterId,
          filmPropId: body.filmPropId,
          filmSceneImageId: body.filmSceneImageId,
          filmAssetKind: body.filmAssetKind || "character",
        });

        const requestPayload = {
          filmSource: "film" as const,
          prompt,
          images: body.images,
          // default 16:9 khớp sheet nhân vật/vật phẩm; client luôn gửi ratio đúng
          aspectRatio: body.aspectRatio === "9:16" ? "9:16" : body.aspectRatio === "16:9" ? "16:9" : "16:9",
          numberOfImages: body.numberOfImages || 1,
          imageModel: body.imageModel,
          noText: body.noText === true,
          filmProjectId: body.filmProjectId,
          filmEpisodeId: body.filmEpisodeId,
          filmSceneId: body.filmSceneId,
          filmCharacterId: body.filmCharacterId,
          filmPropId: body.filmPropId,
          filmSceneImageId: body.filmSceneImageId,
          filmAssetKind: body.filmAssetKind || "character",
        };

        const { jobId, status } = await createAndEnqueueMediaJob({
          customerId: context.id,
          type: MediaGenerationJobType.FILM_GENERATION_IMAGE,
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
          type: MediaGenerationJobType.FILM_GENERATION_IMAGE,
        });
      } catch (err: any) {
        logger.error(`[film-generate-image] Lỗi enqueue: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
