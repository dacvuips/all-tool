import {
  SceneScript,
  ScriptData,
  StoryModeTypeEnum,
  uid,
} from "../constants";
import {
  AUDIO_IMAGE_SCENE_JSON_SCHEMA,
  type AudioImageScene,
  type AudioImageToVideoFormState,
} from "./audio-image-types";
import { buildAudioImageAnalyzePrompt, validateAudioImageAnalyzeForm } from "./build-analyze-prompt";
import {
  AUDIO_ANALYZE_CHUNK_SEC,
  splitAudioBase64IntoChunks,
  type AudioChunk,
} from "./split-audio-chunks";

/** Khoảng cách giữa các lần enqueue generate-text song song (ms). */
export const AUDIO_ANALYZE_STAGGER_MS = 5_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseJsonPayload(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) return { scenes: value };
  if (isRecord(value)) return value;
  if (typeof value === "string") {
    const trimmed = value.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return { scenes: parsed };
      if (isRecord(parsed)) return parsed;
    } catch {
      return null;
    }
  }
  return null;
}

function normalizeScenes(raw: unknown): AudioImageScene[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const row = isRecord(item) ? item : {};
      return {
        sceneNumber: Number(row.sceneNumber) || index + 1,
        dialogue: String(row.dialogue || "").trim(),
        visualPrompt: String(row.visualPrompt || row.visualDescription || "").trim(),
        motionPrompt: String(row.motionPrompt || "").trim(),
      };
    })
    .filter((scene) => scene.dialogue || scene.visualPrompt || scene.motionPrompt);
}

function collectImageInputs(form: AudioImageToVideoFormState) {
  if (form.sourceTab !== "image") return [];
  return (form.imageRefs || [])
    .filter((img) => img.imageBytes)
    .slice(0, 10)
    .map((img) => ({
      imageBytes: img.imageBytes,
      mimeType: img.mimeType || "image/jpeg",
    }));
}

function renumberScenes(scenes: AudioImageScene[]): AudioImageScene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
  }));
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function mapAudioImageScenesToScriptData(
  form: AudioImageToVideoFormState,
  scenes: AudioImageScene[]
): ScriptData {
  const mapped: SceneScript[] = scenes.map((scene, index) => ({
    id: uid(),
    sceneNumber: scene.sceneNumber || index + 1,
    camera: "WIDE SHOT",
    visualPrompt: scene.visualPrompt,
    imageGenPrompt: scene.visualPrompt,
    motionPrompt: scene.motionPrompt,
    dialogue: scene.dialogue,
    aspectRatio: form.aspectRatio,
  }));

  return {
    storyModeType:
      form.sourceTab === "image"
        ? StoryModeTypeEnum.image_to_video
        : StoryModeTypeEnum.prompt_to_video,
    topicTitle: "",
    artStyle: form.artStyle || "",
    artStyleId: form.artStyleId || "",
    environment: "",
    characterName: "",
    characterBaseDescription: "",
    voiceGender: "female",
    voiceTone: "",
    voiceStyle: "",
    aspectRatio: form.aspectRatio,
    scenes: mapped,
  };
}

export type GenerateTextJobResult = {
  data?: {
    json?: unknown;
    text?: unknown;
  };
};

export type AudioImageGenerateTextBody = {
  prompt: string;
  systemInstruction: string;
  jsonMode: true;
  jsonSchema: typeof AUDIO_IMAGE_SCENE_JSON_SCHEMA;
  images?: Array<{ imageBytes: string; mimeType: string }>;
  audios?: Array<{ audioBytes: string; mimeType: string }>;
  /** Metadata job — giữ đúng vị trí chunk khi chạy song song */
  _metadata?: {
    source: "audio-image-to-video";
    chunkIndex: number;
    chunkCount: number;
    startSec?: number;
    endSec?: number;
  };
};

const WHITEBOARD_SYSTEM_INSTRUCTION =
  "You are an expert AI whiteboard animation / drawing-pen slideshow director. Split source media/text into timed scenes for 8-second videos. Every visualPrompt must be a whiteboard slide with a hand holding a marker drawing a flat 2D illustration. Every motionPrompt must describe the hand progressively drawing that slide.";

export function buildAudioImageGenerateTextBody(
  form: AudioImageToVideoFormState,
  options?: {
    chunk?: AudioChunk;
    audios?: Array<{ audioBytes: string; mimeType: string }>;
  }
): AudioImageGenerateTextBody {
  const images = collectImageInputs(form);
  const audios =
    options?.audios ||
    (options?.chunk
      ? [{ audioBytes: options.chunk.audioBytes, mimeType: options.chunk.mimeType }]
      : []);

  const chunk = options?.chunk;
  return {
    prompt: buildAudioImageAnalyzePrompt(form, chunk),
    systemInstruction: WHITEBOARD_SYSTEM_INSTRUCTION,
    jsonMode: true,
    jsonSchema: AUDIO_IMAGE_SCENE_JSON_SCHEMA,
    ...(images.length ? { images } : {}),
    ...(audios.length ? { audios } : {}),
    _metadata: {
      source: "audio-image-to-video",
      chunkIndex: chunk?.chunkIndex ?? 0,
      chunkCount: chunk?.chunkCount ?? 1,
      startSec: chunk?.startSec,
      endSec: chunk?.endSec,
    },
  };
}

async function analyzeOneGenerateTextBody(
  body: AudioImageGenerateTextBody,
  runGenerateTextJob: (body: AudioImageGenerateTextBody) => Promise<GenerateTextJobResult>
): Promise<AudioImageScene[]> {
  const payload = await runGenerateTextJob(body);
  const parsed =
    parseJsonPayload(payload?.data?.json) || parseJsonPayload(payload?.data?.text) || payload?.data;
  return normalizeScenes(isRecord(parsed) ? parsed.scenes : parsed);
}

type ChunkAnalyzeResult = {
  chunkIndex: number;
  scenes: AudioImageScene[];
};

/**
 * Gửi các đoạn audio lên generate-text song song.
 * Đoạn thứ i bắt đầu sau i * staggerMs (mặc định 5s).
 * Kết quả được sắp theo chunkIndex dù API trả về lệch tốc độ.
 */
export async function analyzeAudioChunksInParallel(options: {
  form: AudioImageToVideoFormState;
  chunks: AudioChunk[];
  runGenerateTextJob: (body: AudioImageGenerateTextBody) => Promise<GenerateTextJobResult>;
  staggerMs?: number;
  onChunkEnqueued?: (info: {
    chunkIndex: number;
    chunkCount: number;
    startSec: number;
    endSec: number;
  }) => void;
  onChunkDone?: (info: {
    chunkIndex: number;
    chunkCount: number;
    sceneCount: number;
  }) => void;
}): Promise<AudioImageScene[]> {
  const {
    form,
    chunks,
    runGenerateTextJob,
    staggerMs = AUDIO_ANALYZE_STAGGER_MS,
    onChunkEnqueued,
    onChunkDone,
  } = options;

  const jobs = chunks.map(async (chunk, launchIndex): Promise<ChunkAnalyzeResult> => {
    if (launchIndex > 0) {
      await wait(launchIndex * staggerMs);
    }

    onChunkEnqueued?.({
      chunkIndex: chunk.chunkIndex,
      chunkCount: chunk.chunkCount,
      startSec: chunk.startSec,
      endSec: chunk.endSec,
    });

    try {
      const scenes = await analyzeOneGenerateTextBody(
        buildAudioImageGenerateTextBody(form, { chunk }),
        runGenerateTextJob
      );
      if (!scenes.length) {
        throw new Error(
          `AI không trả về phân cảnh hợp lệ cho đoạn ${chunk.chunkIndex + 1}/${chunk.chunkCount}`
        );
      }
      onChunkDone?.({
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        sceneCount: scenes.length,
      });
      return { chunkIndex: chunk.chunkIndex, scenes };
    } catch (err: any) {
      const message =
        err?.message ||
        `Phân tích đoạn ${chunk.chunkIndex + 1}/${chunk.chunkCount} thất bại`;
      throw Object.assign(new Error(message), {
        chunkIndex: chunk.chunkIndex,
        chunkCount: chunk.chunkCount,
        cause: err,
      });
    }
  });

  const settled = await Promise.allSettled(jobs);
  const failures = settled.filter(
    (item): item is PromiseRejectedResult => item.status === "rejected"
  );
  if (failures.length) {
    const first = failures[0]?.reason;
    throw first instanceof Error ? first : new Error(String(first || "Phân tích song song thất bại"));
  }

  const results = settled
    .filter((item): item is PromiseFulfilledResult<ChunkAnalyzeResult> => item.status === "fulfilled")
    .map((item) => item.value)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  for (let i = 0; i < chunks.length; i++) {
    if (results[i]?.chunkIndex !== i) {
      throw new Error(`Thiếu kết quả phân tích đoạn ${i + 1}/${chunks.length}`);
    }
  }

  return results.flatMap((item) => item.scenes);
}

export async function analyzeAudioImageToVideo(
  form: AudioImageToVideoFormState,
  runGenerateTextJob: (body: AudioImageGenerateTextBody) => Promise<GenerateTextJobResult>,
  options?: {
    onChunkProgress?: (info: {
      chunkIndex: number;
      chunkCount: number;
      startSec: number;
      endSec: number;
    }) => void;
    onChunkDone?: (info: {
      chunkIndex: number;
      chunkCount: number;
      sceneCount: number;
    }) => void;
  }
): Promise<ScriptData> {
  const invalid = validateAudioImageAnalyzeForm(form);
  if (invalid) {
    throw new Error(invalid);
  }

  if (form.sourceTab === "audio") {
    const source = (form.audioRefs || []).find((aud) => aud.audioBytes);
    if (!source?.audioBytes) {
      throw new Error("Vui lòng upload file audio");
    }

    const chunks = await splitAudioBase64IntoChunks({
      audioBytes: source.audioBytes,
      mimeType: source.mimeType || "audio/mpeg",
      chunkSec: AUDIO_ANALYZE_CHUNK_SEC,
    });

    const allScenes = await analyzeAudioChunksInParallel({
      form,
      chunks,
      runGenerateTextJob,
      onChunkEnqueued: options?.onChunkProgress,
      onChunkDone: options?.onChunkDone,
    });

    return mapAudioImageScenesToScriptData(form, renumberScenes(allScenes));
  }

  const scenes = await analyzeOneGenerateTextBody(
    buildAudioImageGenerateTextBody(form, {
      audios: [],
    }),
    runGenerateTextJob
  );
  if (!scenes.length) {
    throw new Error("AI không trả về phân cảnh hợp lệ");
  }

  return mapAudioImageScenesToScriptData(form, renumberScenes(scenes));
}
