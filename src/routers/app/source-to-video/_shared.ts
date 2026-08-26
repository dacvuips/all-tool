/**
 * Shared helpers cho POST /api/app/{audio|image|text}-to-video/
 */
import { Request, Response } from "express";
import {
  cancelFlow2TextRequest,
  generateTextWithFlow2,
  serializeFlow2TextClientResult,
  type Flow2AudioInput,
  type Flow2ImageInput,
} from "../../api-media/flow2";
import { checkRequestLimit, incrementRequestCount } from "../affiliate-scene/_shared";
import {
  AUDIO_IMAGE_SCENE_JSON_SCHEMA,
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

async function runFlow2Direct(
  res: Response,
  req: Request,
  customerId: string,
  params: Parameters<typeof generateTextWithFlow2>[0]
) {
  let requestId = "";
  const onClose = () => {
    if (!requestId) return;
    void cancelFlow2TextRequest(requestId, customerId).catch(() => undefined as void);
  };

  req.on("close", onClose);
  try {
    const { requestId: createdId, result } = await generateTextWithFlow2({
      ...params,
      customerId,
      onRequestCreated: async (id: string) => {
        requestId = id;
      },
    });
    requestId = createdId;
    req.off("close", onClose);
    await incrementRequestCount(customerId);
    return res.json({
      success: true,
      requestId: createdId,
      status: "done",
      type: "gen_text",
      data: serializeFlow2TextClientResult(result),
    });
  } catch (err) {
    req.off("close", onClose);
    throw err;
  }
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
      return runFlow2Direct(res, req, customerId, {
        prompt: buildAudioTranscribePrompt(form),
        systemInstruction: TRANSCRIBE_SYSTEM_INSTRUCTION,
        audioInputs: collectAudios(body),
      });
    }

    return runFlow2Direct(res, req, customerId, {
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

  return runFlow2Direct(res, req, customerId, {
    prompt: buildAudioImageAnalyzePrompt(form, sourceText),
    systemInstruction: buildAudioImageAnalyzeSystemInstruction(form),
    jsonMode: true,
    jsonSchema: AUDIO_IMAGE_SCENE_JSON_SCHEMA,
    imageInputs: sourceTab === "image" ? collectImages(body) : undefined,
  });
}
