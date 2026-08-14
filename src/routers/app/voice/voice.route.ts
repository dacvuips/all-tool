/**
 * Proxy MicroX Voice API — key chỉ nằm server-side.
 *
 * GET  /api/app/voice/account/
 * GET  /api/app/voice/voices/
 * GET  /api/app/voice/jobs/:id/
 * POST /api/app/voice/text-to-speech/
 * POST /api/app/voice/voice-conversion/
 * POST /api/app/voice/voice-clones/
 * POST /api/app/voice/speech-to-text/
 * POST /api/app/voice/audio-cleanup/
 */
import { Request, Response } from "express";
import multer from "multer";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import {
  audioFileFromMulter,
  microxFetch,
  newIdempotencyKey,
  sendRouteError,
} from "./_microx";

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

function authVoice(req: Request) {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  return context;
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

export default [
  {
    method: "get",
    path: "/api/app/voice/account/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        authVoice(req);
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
        authVoice(req);
        const q = req.query || {};
        const { data } = await microxFetch("/voices", {
          query: {
            language: q.language as string,
            category: q.category as string,
            gender: q.gender as string,
            capability: q.capability as string,
            query: q.query as string,
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
    path: "/api/app/voice/jobs/:id/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        authVoice(req);
        const id = String(req.params.id || "").trim();
        if (!id) {
          return res.status(400).json({ message: "Thiếu job id" });
        }
        const { data } = await microxFetch(`/jobs/${encodeURIComponent(id)}`);
        res.json({ success: true, data });
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
        authVoice(req);
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
        res.status(status === 202 ? 202 : 200).json({ success: true, data });
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
        authVoice(req);
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
        res.status(status === 202 ? 202 : 200).json({ success: true, data });
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
        authVoice(req);
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
        res.status(status === 202 ? 202 : 200).json({ success: true, data });
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
        authVoice(req);
        const file = requireAudio(req);
        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);

        const { status, data } = await microxFetch("/speech-to-text", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("stt"),
          form,
        });
        res.status(status === 202 ? 202 : 200).json({ success: true, data });
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
        authVoice(req);
        const file = requireAudio(req);
        const form = new FormData();
        const audio = audioFileFromMulter(file);
        form.append("audio", audio.blob, audio.filename);

        const { status, data } = await microxFetch("/audio-cleanup", {
          method: "POST",
          idempotencyKey: newIdempotencyKey("cleanup"),
          form,
        });
        res.status(status === 202 ? 202 : 200).json({ success: true, data });
      } catch (err: any) {
        sendRouteError(res, err);
      }
    },
  },
];
