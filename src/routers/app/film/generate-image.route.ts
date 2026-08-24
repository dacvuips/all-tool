/**
 * POST /api/app/film/generate-image/
 * Film short-project — enqueue job `FILM_GENERATION_IMAGE` (tách biệt GENERATION_IMAGE).
 */
import { Request, Response } from "express";
import logger from "../../../helpers/logger";
import { MediaGenerationJobType } from "../../../libs/dal/mediaGenerationJob";
import {
  buildFilmJobMetadata,
  type FilmMediaAssetKind,
} from "../../../queues/media-generation/handlers/film-job.types";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { sendEnqueueErrorResponse } from "../media-generation-job/send-enqueue-error";
import { checkImageLimit } from "../affiliate-scene/_shared";
import { authFilmFeature } from "./_film-access";

export default [
  {
    method: "post",
    path: "/api/app/film/generate-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authFilmFeature(req);

        const body = req.body as {
          prompt?: string;
          images?: Array<string | { imageBytes: string; mimeType?: string }>;
          aspectRatio?: "16:9" | "9:16";
          numberOfImages?: number;
          imageModel?: string;
          noText?: boolean;
          /** ID collection artstyles — handler resolve prompt gắn vào prompt tạo ảnh */
          artStyleId?: string;
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

        const artStyleId = String(body.artStyleId || "").trim() || undefined;

        const requestPayload = {
          filmSource: "film" as const,
          prompt,
          images: body.images,
          // default 16:9 khớp sheet nhân vật/vật phẩm; client luôn gửi ratio đúng
          aspectRatio: body.aspectRatio === "9:16" ? "9:16" : body.aspectRatio === "16:9" ? "16:9" : "16:9",
          numberOfImages: body.numberOfImages || 1,
          imageModel: body.imageModel,
          noText: body.noText === true,
          artStyleId,
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
        sendEnqueueErrorResponse(res, err);
      }
    },
  },
];
