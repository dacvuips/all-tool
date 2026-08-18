/**
 * Proxy VietTheo Voice API — key chỉ nằm server-side.
 *
 * GET  /api/app/voice/account/
 * GET  /api/app/voice/voices/
 * GET  /api/app/voice/voices/:id/preview/
 * GET  /api/app/voice/jobs/:id/
 * POST /api/app/voice/text-to-speech/
 * POST /api/app/voice/voice-conversion/
 * POST /api/app/voice/voice-clones/
 * POST /api/app/voice/speech-to-text/
 * POST /api/app/voice/audio-cleanup/
 * POST /api/app/voice/free-gen-audio/
 * GET  /api/app/voice/free-gen-audio/:id/
 * GET  /api/app/voice/free-gen-audio/:id/output/
 */
import { Request, Response } from "express";
import multer from "multer";
import { TOKEN_ROLES } from "../../../constants/role.const";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
  MediaGenerationJobStatus,
  MediaGenerationJobType,
} from "../../../libs/dal/mediaGenerationJob";
import { Context } from "../../../libs/graphql";
import { createAndEnqueueMediaJob } from "../media-generation-job/_enqueue-helper";
import { assertVoiceGenerationAllowed, authVoiceCustomer } from "./_access";
import {
  fetchFreeGenAudioBytes,
  sanitizeFreeGenAudioJobForClient,
} from "./_free-gen-audio";
import {
  audioFileFromMulter,
  microxFetch,
  microxFetchJobOutput,
  microxFetchVoicePreview,
  newIdempotencyKey,
  sanitizeJobForClient,
  sendRouteError,
} from "./_microx";
import { assertTextCreditRemaining, maybeConsumeTextCreditFromJob } from "./_text-credit";

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AUDIO_BYTES, files: 1 },
}).single("audio");

function parseAudioUpload(req: Request, res: Response, next: (err?: unknown) => void) {
  audioUpload(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : "Upload audio thất bại";
      return res.status(400).json({ message });
    }
    next();
  });
}

async function authVoicePaid(req: Request) {
  const context = authVoiceCustomer(req);
  await assertVoiceGenerationAllowed(context);
  return context;
}

async function authVoiceCreate(req: Request) {
  const context = await authVoicePaid(req);
  await assertTextCreditRemaining(context.id);
  return context;
}

async function sendVoiceJob(
  res: Response,
  status: number,
  data: any,
  customerId: string,
  tool: string
) {
  await maybeConsumeTextCreditFromJob(customerId, data, tool);
  res.status(status === 202 ? 202 : 200).json({ success: true, data: sanitizeJobForClient(data) });
}

function requireAudio(req: Request) {
  const file = req.file;
  if (!file?.buffer?.length) {
    throw Object.assign(new Error("Thiếu file audio"), { statusCode: 400 });
  }
  return file;
}

function appendOptional(form: FormData, key: string, value: unknown) {
  if (value === undefined || value === null || String(value).trim() === "") return;
  form.append(key, String(value));
}

function mapMediaJobStatusToVoiceJob(status: MediaGenerationJobStatus | string): string {
  switch (status) {
    case MediaGenerationJobStatus.SUCCEEDED:
      return "completed";
    case MediaGenerationJobStatus.FAILED:
    case MediaGenerationJobStatus.CANCELLED:
      return "failed";
    default:
      return "processing";
  }
}

function sanitizeFreeGenAudioMediaJob(job: IMediaGenerationJob | null) {
  const rootResult =
    job?.resultData && typeof job.resultData === "object"
      ? (job.resultData as Record<string, unknown>)
      : null;
  const rawResult =
    rootResult?.data && typeof rootResult.data === "object"
      ? (rootResult.data as Record<string, unknown>)
      : rootResult;
  const nestedResult =
    rawResult?.result && typeof rawResult.result === "object"
      ? (rawResult.result as Record<string, unknown>)
      : rawResult;
  const data = sanitizeFreeGenAudioJobForClient({
    id: String((job as any)?._id || ""),
    status: mapMediaJobStatusToVoiceJob(String(job?.status || "") as MediaGenerationJobStatus),
    result: nestedResult || {},
  } as any);
  if (job?.errorMessage) {
    (data as any).message = job.errorMessage;
    (data as any).error = job.errorMessage;
  }
  return data;
}

async function getOwnedMediaJob(req: Request): Promise<IMediaGenerationJob> {
  const context = authVoiceCustomer(req);
  const id = String(req.params.id || "").trim();
  const job = (await mediaGenerationJobService.findOne({
    _id: id,
  })) as unknown as IMediaGenerationJob | null;
  if (!job) {
    throw Object.assign(new Error("Không tìm thấy job"), { statusCode: 404 });
  }
  if (job.customerId !== context.id) {
    throw Object.assign(new Error("Bạn không có quyền truy cập job này"), { statusCode: 403 });
  }
  if (job.type !== MediaGenerationJobType.VOICE_FREE_GEN_AUDIO) {
    throw Object.assign(new Error("Job không thuộc gen audio miễn phí"), { statusCode: 400 });
  }
  return job;
}

export default [
  {
    method: "get",
    path: "/api/app/voice/account/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        await context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const { data } = await microxFetch("/account");
        res.json({ success: true, data });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/voices/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        authVoiceCustomer(req);
        const q = req.query || {};
        const { data } = await microxFetch("/voices", {
          query: {
            language: q.language as string,
            category: q.category as string,
            gender: q.gender as string,
            capability: q.capability as string,
            query: q.query as string,
            accent: q.accent as string,
            engine: q.engine as string,
            sort: q.sort as string,
            page: q.page as string,
            limit: q.limit as string,
          },
        });
        res.json({ success: true, data });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/voices/:id/preview/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        authVoiceCustomer(req);
        const id = String(req.params.id || "").trim();
        if (!id || !/^(voice_|clone_)/.test(id)) {
          return res.status(400).json({ message: "Voice id không hợp lệ" });
        }
        const { buffer, contentType } = await microxFetchVoicePreview(id);
        res.setHeader("Content-Type", contentType || "audio/mpeg");
        res.setHeader("Cache-Control", "private, max-age=300");
        res.send(buffer);
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/jobs/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoicePaid(req);
        const id = String(req.params.id || "").trim();
        if (!id) {
          return res.status(400).json({ message: "Thiếu job id" });
        }
        const { data } = await microxFetch(`/jobs/${encodeURIComponent(id)}`);
        const tool = String(req.query.tool || "").trim();
        await maybeConsumeTextCreditFromJob(context.id, data, tool);
        res.json({ success: true, data: sanitizeJobForClient(data) });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/jobs/:id/output/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        await authVoicePaid(req);
        const id = String(req.params.id || "").trim();
        if (!id) {
          return res.status(400).json({ message: "Thiếu job id" });
        }
        const index = Math.max(0, Number(req.query.index) || 0);
        const { buffer, contentType } = await microxFetchJobOutput(id, index);
        res.setHeader("Content-Type", contentType || "audio/mpeg");
        res.setHeader("Cache-Control", "private, max-age=60");
        res.send(buffer);
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/text-to-speech/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoiceCreate(req);
        const body = (req.body || {}) as {
          voice_id?: string;
          text?: string;
          speed?: number;
          creativity?: number;
        };
        const voiceId = String(body.voice_id || "").trim();
        const text = String(body.text || "").trim();
        if (!voiceId) return res.status(400).json({ message: "Thiếu voice_id" });
        if (!text) return res.status(400).json({ message: "Thiếu text" });

        const speed = Number(body.speed);
        const creativity = Number(body.creativity);
        const { status, data } = await microxFetch("/text-to-speech", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("tts"),
          json: {
            voice_id: voiceId,
            text,
            speed: Number.isFinite(speed) ? speed : 1,
            creativity: Number.isFinite(creativity) ? creativity : 0.5,
          },
        });
        await sendVoiceJob(res, status, data, context.id, "tts");
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/voice-conversion/",
    midd: [parseAudioUpload],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoiceCreate(req);
        const file = requireAudio(req);
        const voiceId = String(req.body?.voice_id || "").trim();
        if (!voiceId) return res.status(400).json({ message: "Thiếu voice_id" });

        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);
        form.append("voice_id", voiceId);
        appendOptional(form, "stability", req.body?.stability);
        appendOptional(form, "similarity", req.body?.similarity);
        appendOptional(form, "style", req.body?.style);
        appendOptional(form, "remove_background_noise", req.body?.remove_background_noise);

        const { status, data } = await microxFetch("/voice-conversion", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("conversion"),
          form,
        });
        await sendVoiceJob(res, status, data, context.id, "conversion");
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/voice-clones/",
    midd: [parseAudioUpload],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoiceCreate(req);
        const file = requireAudio(req);
        const name = String(req.body?.name || "").trim();
        if (!name) return res.status(400).json({ message: "Thiếu tên giọng clone" });

        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);
        form.append("name", name);
        appendOptional(form, "remove_background_noise", req.body?.remove_background_noise);

        const { status, data } = await microxFetch("/voice-clones", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("clone"),
          form,
        });
        await sendVoiceJob(res, status, data, context.id, "clone");
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/speech-to-text/",
    midd: [parseAudioUpload],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoiceCreate(req);
        const file = requireAudio(req);
        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);

        const { status, data } = await microxFetch("/speech-to-text", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("stt"),
          form,
        });
        await sendVoiceJob(res, status, data, context.id, "stt");
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/audio-cleanup/",
    midd: [parseAudioUpload],
    action: async (req: Request, res: Response) => {
      try {
        const context = await authVoiceCreate(req);
        const file = requireAudio(req);
        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);

        const { status, data } = await microxFetch("/audio-cleanup", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("cleanup"),
          form,
        });
        await sendVoiceJob(res, status, data, context.id, "cleanup");
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "post",
    path: "/api/app/voice/free-gen-audio/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = authVoiceCustomer(req);
        const body = (req.body || {}) as { text?: string; voice?: string };
        const text = String(body.text || "").trim();
        const voice = String(body.voice || "").trim().toLowerCase();
        if (!text) return res.status(400).json({ message: "Thiếu text" });
        if (!voice) return res.status(400).json({ message: "Thiếu voice" });

        const { jobId, status } = await createAndEnqueueMediaJob(
          {
            customerId: context.id,
            type: MediaGenerationJobType.VOICE_FREE_GEN_AUDIO,
            requestPayload: { text, voice },
            metadata: { module: "voice", tool: "free-gen-audio" },
          },
          { skipStreamCheck: true }
        );

        res.status(202).json({
          success: true,
          jobId,
          status,
          type: MediaGenerationJobType.VOICE_FREE_GEN_AUDIO,
          data: sanitizeFreeGenAudioJobForClient({
            id: jobId,
            status: "processing",
            result: {},
          } as any),
        });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/free-gen-audio/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const job = await getOwnedMediaJob(req);
        res.json({ success: true, data: sanitizeFreeGenAudioMediaJob(job) });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
  {
    method: "get",
    path: "/api/app/voice/free-gen-audio/:id/output/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const job = await getOwnedMediaJob(req);
        const resultData =
          job.resultData && typeof job.resultData === "object"
            ? (job.resultData as Record<string, unknown>)
            : null;
        const nested =
          resultData?.data && typeof resultData.data === "object"
            ? (resultData.data as Record<string, unknown>)
            : resultData;
        const flow2RequestId = String(nested?.flow2RequestId || "").trim();
        if (!flow2RequestId) {
          return res.status(404).json({ message: "Job chưa có audio đầu ra" });
        }
        const { buffer, contentType } = await fetchFreeGenAudioBytes(flow2RequestId, job.customerId);
        res.setHeader("Content-Type", contentType || "audio/mpeg");
        res.setHeader("Cache-Control", "private, max-age=300");
        res.send(buffer);
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
];
