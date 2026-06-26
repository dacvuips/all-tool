import { Request, Response } from "express";
import logger from "../../helpers/logger";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
  MediaGenerationJobType,
} from "../../libs/dal/mediaGenerationJob";
import { ActionEnum } from "../app/affiliate-scene/_shared";
import { createAndEnqueueApiMediaJob } from "./_enqueue-helper";
import { resolveApiMediaTokenFromRequest } from "./api-media-key";
import { prepareApiMediaImageRequest, prepareApiMediaVideoRequest } from "./api-media-prepare";
import { assertApiMediaRateLimit } from "./api-media-rate-limit";
import {
  assertApiMediaFlow2RequestOwner,
  assertApiMediaMediaUpscaleOwner,
} from "./api-media-upscale-registry";
import {
  upsampleImageWithFlow2,
  UpsampleResolution,
} from "./flow2/upsample-image";
import { upsampleVideoWithFlow2 } from "./flow2/upsample-video";

function serializeJob(doc: IMediaGenerationJob | null) {
  if (!doc) return null;
  const json: any = (doc as any).toObject ? (doc as any).toObject() : doc;
  return {
    id: String(json._id),
    type: json.type,
    status: json.status,
    progress: json.progress ?? 0,
    message: json.message ?? null,
    resultData: json.resultData ?? null,
    errorMessage: json.errorMessage ?? null,
    errorCode: json.errorCode ?? null,
    attempts: json.attempts ?? 0,
    createdAt: json.createdAt,
    startedAt: json.startedAt ?? null,
    completedAt: json.completedAt ?? null,
  };
}

function resolveJobType(
  action?: string
): MediaGenerationJobType.API_MEDIA_IMAGE | MediaGenerationJobType.API_MEDIA_VIDEO {
  if (action === ActionEnum.IMAGE_GENERATION) {
    return MediaGenerationJobType.API_MEDIA_IMAGE;
  }
  if (action === ActionEnum.VIDEO_GENERATION) {
    return MediaGenerationJobType.API_MEDIA_VIDEO;
  }
  const err: any = new Error(
    `Tham số type không hợp lệ. Hỗ trợ: ${ActionEnum.IMAGE_GENERATION}, ${ActionEnum.VIDEO_GENERATION}`
  );
  err.statusCode = 400;
  throw err;
}

function parseUpsampleResolution(value: unknown): UpsampleResolution {
  const normalized = String(value || "4K").toUpperCase();
  return normalized === "2K" ? "2K" : "4K";
}

async function enqueueApiMediaJob(req: Request, res: Response): Promise<void> {
  const token = await resolveApiMediaTokenFromRequest(req);
  const apiMediaTokenId = String(token._id);
  await assertApiMediaRateLimit(req, apiMediaTokenId);

  const customerId = token.customerId ? String(token.customerId) : null;
  if (!customerId) {
    const err: any = new Error("Token chưa gắn khách hàng");
    err.statusCode = 403;
    throw err;
  }

  const action = (req.query.type as string) || (req.body as { type?: string })?.type;
  const jobType = resolveJobType(action);
  const body = (req.body || {}) as Record<string, unknown>;

  const requestPayload =
    jobType === MediaGenerationJobType.API_MEDIA_IMAGE
      ? await prepareApiMediaImageRequest(body)
      : await prepareApiMediaVideoRequest(body);

  const { jobId, status } = await createAndEnqueueApiMediaJob({
    customerId,
    type: jobType,
    requestPayload: requestPayload as unknown as Record<string, unknown>,
    apiMediaTokenId,
  });

  res.status(202).json({
    success: true,
    jobId,
    status,
    message: "Job đã được tạo. Poll GET /api/api-media/job/:jobId để lấy kết quả.",
  });
}

async function getApiMediaJob(req: Request, res: Response): Promise<void> {
  const token = await resolveApiMediaTokenFromRequest(req);
  const apiMediaTokenId = String(token._id);
  await assertApiMediaRateLimit(req, apiMediaTokenId);

  const { id } = req.params as { id: string };

  const job = (await mediaGenerationJobService.findOne({ _id: id })) as unknown as IMediaGenerationJob | null;
  if (!job) {
    res.status(404).json({ message: "Không tìm thấy job" });
    return;
  }

  const jobTokenId = (job as any).metadata?.apiMediaTokenId;
  if (jobTokenId !== apiMediaTokenId) {
    res.status(403).json({ message: "Bạn không có quyền truy cập job này" });
    return;
  }

  res.json({ success: true, data: serializeJob(job) });
}

async function upsampleApiMediaImage(req: Request, res: Response): Promise<void> {
  const token = await resolveApiMediaTokenFromRequest(req);
  const apiMediaTokenId = String(token._id);
  await assertApiMediaRateLimit(req, apiMediaTokenId);

  const body = req.body as {
    resolution?: UpsampleResolution | string;
    flow2RequestId?: string;
    requestId?: string;
    mediaId?: string;
    projectId?: string;
    profileId?: string;
  };

  const resolution = parseUpsampleResolution(body?.resolution);
  const flow2RequestId = (body?.flow2RequestId || body?.requestId || "").trim();
  const mediaId = body?.mediaId?.trim();
  const projectId = body?.projectId?.trim();
  const profileId = body?.profileId?.trim();

  if (resolution === "2K") {
    if (!flow2RequestId) {
      res.status(400).json({ message: "Thiếu flow2RequestId (request_id từ job gen_image)" });
      return;
    }
    await assertApiMediaFlow2RequestOwner(apiMediaTokenId, flow2RequestId);
  } else if (!mediaId || !projectId || !profileId) {
    res.status(400).json({
      message: "Thiếu mediaId, projectId hoặc profileId để upscale 4K",
    });
    return;
  } else {
    await assertApiMediaMediaUpscaleOwner(apiMediaTokenId, mediaId, projectId, profileId);
  }

  const result =
    resolution === "2K"
      ? await upsampleImageWithFlow2({ resolution: "2K", flow2RequestId: flow2RequestId! })
      : await upsampleImageWithFlow2({
          resolution: "4K",
          mediaId: mediaId!,
          projectId: projectId!,
          profileId: profileId!,
        });

  res.json({
    success: true,
    data: {
      imageBytes: result.imageBytes,
      mimeType: result.mimeType,
    },
  });
}

async function upsampleApiMediaVideo(req: Request, res: Response): Promise<void> {
  const token = await resolveApiMediaTokenFromRequest(req);
  const apiMediaTokenId = String(token._id);
  await assertApiMediaRateLimit(req, apiMediaTokenId);

  const body = req.body as { requestId?: string; flow2RequestId?: string };
  const requestId = (body?.requestId || body?.flow2RequestId || "").trim();
  if (!requestId) {
    res.status(400).json({ message: "Thiếu requestId từ job gen video" });
    return;
  }

  await assertApiMediaFlow2RequestOwner(apiMediaTokenId, requestId);

  const result = await upsampleVideoWithFlow2({ flow2RequestId: requestId });

  res.json({
    success: true,
    data: {
      videoBytes: result.videoBytes,
      mimeType: result.mimeType,
    },
  });
}

export default [
  {
    method: "post",
    path: "/api/api-media",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        await enqueueApiMediaJob(req, res);
      } catch (err: any) {
        logger.error(`[api-media] enqueue lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "get",
    path: "/api/api-media/job/:id",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        await getApiMediaJob(req, res);
      } catch (err: any) {
        logger.error(`[api-media] get job lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "post",
    path: "/api/api-media/upsample-image",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        await upsampleApiMediaImage(req, res);
      } catch (err: any) {
        logger.error(`[api-media] upsample-image lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale ảnh" });
      }
    },
  },
  {
    method: "post",
    path: "/api/api-media/upsample-video",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        await upsampleApiMediaVideo(req, res);
      } catch (err: any) {
        logger.error(`[api-media] upsample-video lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi upscale video" });
      }
    },
  },
];
