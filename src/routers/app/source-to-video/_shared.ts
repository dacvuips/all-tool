/**
 * Shared helpers cho POST /api/app/{audio|image|text}-to-video/
 * Tạo request Flow2 → trả requestId; client poll GET /api/app/generate-text/:id/
 */
import { Request, Response } from "express";
import logger from "../../../helpers/logger";
import {
  createFlow2TextRequest,
  type Flow2AudioInput,
  type Flow2ImageInput,
} from "../../api-media/flow2";
import { checkRequestLimit, incrementRequestCount } from "../affiliate-scene/_shared";
import {
  AUDIO_IMAGE_SCENE_JSON_SCHEMA,
  AUDIO_TIMED_TRANSCRIPT_JSON_SCHEMA,
  TRANSCRIBE_SYSTEM_INSTRUCTION,
  buildAudioImageAnalyzePrompt,
  buildAudioImageAnalyzeSystemInstruction,
  buildAudioTranscribePrompt,
  buildImageExtractTextPrompt,
  type SourceTab,
  type SourceToVideoFormLike,
} from "./_prompts";

export type SourceToVideoPhase = "transcribe" | "analyze";

export type SourceToVideoBody = {
  phase?: SourceToVideoPhase;
  language?: string;
  rhythm?: string;
  aspectRatio?: string;
  artStyle?: string;
  artStyleId?: string;
  showDrawingHand?: boolean;
  textContent?: string;
  sourceText?: string;
  images?: Flow2ImageInput[];
  image_base64s?: Flow2ImageInput[];
  audios?: Flow2AudioInput[];
  audio_base64s?: Flow2AudioInput[];
};

function asTrimmed(value: unknown): string {
  return String(value ?? "").trim();
}

function collectImages(body: SourceToVideoBody): Flow2ImageInput[] {
  const raw = Array.isArray(body.images)
    ? body.images
    : Array.isArray(body.image_base64s)
      ? body.image_base64s
      : [];
  return raw.filter(Boolean).slice(0, 10);
}

function collectAudios(body: SourceToVideoBody): Flow2AudioInput[] {
  const raw = Array.isArray(body.audios)
    ? body.audios
    : Array.isArray(body.audio_base64s)
      ? body.audio_base64s
      : [];
  return raw.filter(Boolean).slice(0, 10);
}

function toFormLike(sourceTab: SourceTab, body: SourceToVideoBody): SourceToVideoFormLike {
  return {
    sourceTab,
    language: asTrimmed(body.language) || "Vietnamese",
    rhythm: asTrimmed(body.rhythm) || "full_analysis",
    aspectRatio: asTrimmed(body.aspectRatio) || "9:16",
    artStyle: asTrimmed(body.artStyle),
    artStyleId: asTrimmed(body.artStyleId),
    showDrawingHand: body.showDrawingHand !== false,
    textContent: asTrimmed(body.textContent),
    imageCount: collectImages(body).length,
  };
}

function validateSource(sourceTab: SourceTab, body: SourceToVideoBody): string | null {
  if (sourceTab === "text" && !asTrimmed(body.textContent) && !asTrimmed(body.sourceText)) {
    return "Vui lòng nhập nội dung văn bản";
  }
  if (sourceTab === "image" && !collectImages(body).length) {
    return "Vui lòng upload ít nhất 1 ảnh";
  }
  if (sourceTab === "audio" && !collectAudios(body).length) {
    return "Vui lòng upload file audio";
  }
  return null;
}

/** Tạo request Flow2 gen_text — không chờ kết quả; client poll theo requestId. */
async function createFlow2AndReturnId(
  res: Response,
  customerId: string,
  params: Parameters<typeof createFlow2TextRequest>[0]
) {
  const audios = params.audioInputs || [];
  if (audios.length) {
    let b64 = 0;
    for (const item of audios) {
      b64 +=
        typeof item === "string" ? item.length : String(item?.audioBytes || "").length;
    }
    logger.info(
      `[source-to-video] Flow2 create gen_text: audios=${audios.length}, base64Chars≈${b64} (~${(
        (b64 * 3) /
        4 /
        (1024 * 1024)
      ).toFixed(1)}MB raw)`
    );
  }

  const { requestId } = await createFlow2TextRequest({
    ...params,
    customerId,
  });
  await incrementRequestCount(customerId);
  return res.status(202).json({
    success: true,
    requestId,
    status: "queued",
    type: "gen_text",
  });
}

export async function handleSourceToVideoRequest(
  sourceTab: SourceTab,
  req: Request,
  res: Response,
  customerId: string
) {
  const body = (req.body || {}) as SourceToVideoBody;
  const phase: SourceToVideoPhase = body.phase === "analyze" ? "analyze" : "transcribe";
  const form = toFormLike(sourceTab, body);

  if (phase === "transcribe") {
    const invalid = validateSource(sourceTab, body);
    if (invalid) {
      return res.status(400).json({ message: invalid });
    }

    if (sourceTab === "text") {
      const text = asTrimmed(body.textContent) || asTrimmed(body.sourceText);
      return res.json({
        success: true,
        phase: "transcribe",
        data: { text, json: null },
      });
    }

    await checkRequestLimit(customerId);

    if (sourceTab === "audio") {
      return createFlow2AndReturnId(res, customerId, {
        prompt: buildAudioTranscribePrompt(form),
        systemInstruction: TRANSCRIBE_SYSTEM_INSTRUCTION,
        audioInputs: collectAudios(body),
        jsonMode: true,
        jsonSchema: AUDIO_TIMED_TRANSCRIPT_JSON_SCHEMA,
      });
    }

    return createFlow2AndReturnId(res, customerId, {
      prompt: buildImageExtractTextPrompt(form),
      systemInstruction: TRANSCRIBE_SYSTEM_INSTRUCTION,
      imageInputs: collectImages(body),
    });
  }

  // analyze
  const sourceText = asTrimmed(body.sourceText) || asTrimmed(body.textContent);
  if (!sourceText) {
    return res.status(400).json({
      message: "Chưa có nội dung text để phân tích. Hãy chạy bước Lấy text trước.",
    });
  }

  await checkRequestLimit(customerId);

  // Phân tích chỉ dựa trên text đã lấy (audio/image/text) — giống luồng audio.
  // Không gửi lại ảnh OCR ở bước analyze để tránh lệch nội dung.
  return createFlow2AndReturnId(res, customerId, {
    prompt: buildAudioImageAnalyzePrompt(form, sourceText),
    systemInstruction: buildAudioImageAnalyzeSystemInstruction(form),
    jsonMode: true,
    jsonSchema: AUDIO_IMAGE_SCENE_JSON_SCHEMA,
  });
}
