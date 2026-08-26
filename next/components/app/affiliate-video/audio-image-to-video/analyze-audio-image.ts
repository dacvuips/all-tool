import {
  SceneScript,
  ScriptData,
  StoryModeTypeEnum,
  uid,
} from "../constants";
import {
  type AudioImageScene,
  type AudioImageToVideoFormState,
  type SourceTab,
} from "./audio-image-types";
import { applyStyleLockToScenes, resolveAudioImageArtStyle, toStillImageGenPrompt } from "./default-art-style";
import { validateAudioImageAnalyzeForm } from "./build-analyze-prompt";

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

function extractPlainText(payload: SourceToVideoApiResult): string {
  const data = payload?.data;
  if (!data) return "";

  if (typeof data.text === "string" && data.text.trim()) {
    return data.text.trim();
  }

  const jsonValue = data.json;
  if (typeof jsonValue === "string" && jsonValue.trim()) {
    return jsonValue.trim();
  }

  if (isRecord(jsonValue)) {
    for (const key of ["transcript", "text", "content"]) {
      const value = jsonValue[key];
      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }
  }

  return "";
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

function collectAudioInputs(form: AudioImageToVideoFormState) {
  if (form.sourceTab !== "audio") return [];
  const source = (form.audioRefs || []).find((aud) => aud.audioBytes);
  if (!source?.audioBytes) return [];
  return [{ audioBytes: source.audioBytes, mimeType: source.mimeType || "audio/mpeg" }];
}

function renumberScenes(scenes: AudioImageScene[]): AudioImageScene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
  }));
}

export function mapAudioImageScenesToScriptData(
  form: AudioImageToVideoFormState,
  scenes: AudioImageScene[]
): ScriptData {
  const mapped: SceneScript[] = scenes.map((scene, index) => ({
    id: uid(),
    sceneNumber: scene.sceneNumber || index + 1,
    camera: "WIDE SHOT",
    visualPrompt: scene.visualPrompt,
    // Generate Image: luôn dùng bản đã loại bàn tay / bút
    imageGenPrompt: toStillImageGenPrompt(scene.visualPrompt),
    motionPrompt: scene.motionPrompt,
    dialogue: scene.dialogue,
    aspectRatio: form.aspectRatio,
  }));

  return {
    storyModeType: StoryModeTypeEnum.image_to_video,
    topicTitle: "",
    artStyle: form.artStyle?.trim() || resolveAudioImageArtStyle(form),
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

export type SourceToVideoApiResult = {
  data?: {
    json?: unknown;
    text?: unknown;
  };
};

function sourceApiPath(sourceTab: SourceTab): string {
  if (sourceTab === "audio") return "/api/app/audio-to-video/";
  if (sourceTab === "image") return "/api/app/image-to-video/";
  return "/api/app/text-to-video/";
}

async function callSourceToVideoApi(
  form: AudioImageToVideoFormState,
  phase: "transcribe" | "analyze",
  sourceText?: string
): Promise<SourceToVideoApiResult> {
  const images = collectImageInputs(form);
  const audios = collectAudioInputs(form);

  const res = await fetch(sourceApiPath(form.sourceTab), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      phase,
      language: form.language,
      rhythm: form.rhythm,
      aspectRatio: form.aspectRatio,
      artStyle: form.artStyle,
      artStyleId: form.artStyleId,
      showDrawingHand: form.showDrawingHand,
      textContent: form.textContent,
      ...(sourceText ? { sourceText } : {}),
      ...(images.length ? { images } : {}),
      ...(audios.length ? { audios } : {}),
    }),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || `Lỗi API (${res.status})`);
  }
  return { data: payload?.data };
}

/** Step 1: lấy text từ audio / ảnh, hoặc dùng text có sẵn. */
export async function transcribeSourceText(
  form: AudioImageToVideoFormState
): Promise<string> {
  const invalid = validateAudioImageAnalyzeForm(form);
  if (invalid) {
    throw new Error(invalid);
  }

  const payload = await callSourceToVideoApi(form, "transcribe");
  const text = extractPlainText(payload);
  if (!text) {
    if (form.sourceTab === "audio") throw new Error("Không lấy được text từ audio");
    if (form.sourceTab === "image") throw new Error("Không lấy được nội dung từ ảnh");
    throw new Error("Vui lòng nhập nội dung văn bản");
  }
  return text;
}

/** Step 2: phân tích toàn bộ text → scenes với visual/motion prompt. */
export async function analyzeSourceTextToScenes(
  form: AudioImageToVideoFormState,
  sourceText: string
): Promise<ScriptData> {
  const text = sourceText.trim();
  if (!text) {
    throw new Error("Chưa có nội dung text để phân tích. Hãy chạy bước Lấy text trước.");
  }

  const payload = await callSourceToVideoApi(form, "analyze", text);
  const parsed =
    parseJsonPayload(payload?.data?.json) || parseJsonPayload(payload?.data?.text) || payload?.data;
  const scenesRaw = isRecord(parsed) && "scenes" in parsed ? parsed.scenes : parsed;
  const scenes = normalizeScenes(scenesRaw);
  if (!scenes.length) {
    throw new Error("AI không trả về phân cảnh hợp lệ");
  }

  const artStyle = resolveAudioImageArtStyle(form);
  const styledScenes = applyStyleLockToScenes(scenes, artStyle);

  return mapAudioImageScenesToScriptData(form, renumberScenes(styledScenes));
}
