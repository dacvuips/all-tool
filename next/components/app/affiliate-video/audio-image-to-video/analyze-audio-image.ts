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
  type TimedTranscriptSegment,
} from "./audio-image-types";
import {
  ensureMotionStartsFromBlankPaper,
  resolveAudioImageArtStyle,
} from "./default-art-style";
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

function parseOptionalSec(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

/** Chuẩn hoá segment timed từ JSON transcribe. */
export function normalizeTimedSegments(raw: unknown): TimedTranscriptSegment[] {
  let list: unknown[] = [];
  if (Array.isArray(raw)) {
    list = raw;
  } else if (isRecord(raw)) {
    if (Array.isArray(raw.segments)) list = raw.segments;
    else if (Array.isArray(raw.items)) list = raw.items;
  }

  return list
    .map((item) => {
      const row = isRecord(item) ? item : {};
      const text = String(row.text || row.dialogue || row.content || "").trim();
      const startTime = parseOptionalSec(row.startTime ?? row.start ?? row.start_sec);
      const endTime = parseOptionalSec(row.endTime ?? row.end ?? row.end_sec);
      if (!text || startTime == null || endTime == null || endTime <= startTime) return null;
      return { text, startTime, endTime } satisfies TimedTranscriptSegment;
    })
    .filter((s): s is TimedTranscriptSegment => !!s)
    .sort((a, b) => a.startTime - b.startTime);
}

/** Serialize segments để gửi analyze / lưu storage (object đầy đủ, không chỉ text). */
export function serializeTimedTranscript(segments: TimedTranscriptSegment[]): string {
  return JSON.stringify({
    segments: segments.map((s) => ({
      text: s.text,
      startTime: s.startTime,
      endTime: s.endTime,
    })),
  });
}

/** Text hiển thị (gộp lời thoại). */
export function formatTimedTranscriptPlain(segments: TimedTranscriptSegment[]): string {
  return segments.map((s) => s.text).join("\n").trim();
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

/** Lấy transcript timed từ payload Flow2 (audio). Fallback plain text → []. */
export function extractTimedTranscript(payload: SourceToVideoApiResult): {
  segments: TimedTranscriptSegment[];
  plainFallback: string;
} {
  const data = payload?.data;
  if (!data) return { segments: [], plainFallback: "" };

  const tryNormalize = (raw: unknown): TimedTranscriptSegment[] => {
    const direct = normalizeTimedSegments(raw);
    if (direct.length) return direct;
    const parsed = parseJsonPayload(raw);
    if (!parsed) return [];
    return normalizeTimedSegments(parsed.segments ?? parsed);
  };

  const fromJson = tryNormalize(data.json);
  if (fromJson.length) {
    return { segments: fromJson, plainFallback: formatTimedTranscriptPlain(fromJson) };
  }

  const plain = extractPlainText(payload);
  const fromPlain = tryNormalize(plain);
  if (fromPlain.length) {
    return { segments: fromPlain, plainFallback: formatTimedTranscriptPlain(fromPlain) };
  }

  return { segments: [], plainFallback: plain };
}

function normalizeScenes(raw: unknown): AudioImageScene[] {
  const list = Array.isArray(raw) ? raw : [];
  return list
    .map((item, index) => {
      const row = isRecord(item) ? item : {};
      const startTime = parseOptionalSec(row.startTime ?? row.start ?? row.start_sec);
      const endTime = parseOptionalSec(row.endTime ?? row.end ?? row.end_sec);
      const scene: AudioImageScene = {
        sceneNumber: Number(row.sceneNumber) || index + 1,
        dialogue: String(row.dialogue || "").trim(),
        visualPrompt: String(row.visualPrompt || row.visualDescription || "").trim(),
        motionPrompt: String(row.motionPrompt || "").trim(),
      };
      if (startTime != null && endTime != null && endTime > startTime) {
        scene.startTime = startTime;
        scene.endTime = endTime;
      }
      return scene;
    })
    .filter((scene) => scene.dialogue || scene.visualPrompt || scene.motionPrompt);
}

function stripToRawBase64(value: string): string {
  const trimmed = (value || "").trim();
  if (!trimmed) return "";
  const comma = trimmed.indexOf(",");
  if (trimmed.startsWith("data:") && comma >= 0) {
    return trimmed.slice(comma + 1);
  }
  return trimmed;
}

function collectImageInputs(form: AudioImageToVideoFormState) {
  if (form.sourceTab !== "image") return [];
  return (form.imageRefs || [])
    .filter((img) => img.imageBytes)
    .slice(0, 10)
    .map((img) => ({
      imageBytes: stripToRawBase64(img.imageBytes),
      mimeType: img.mimeType || "image/jpeg",
    }))
    .filter((img) => img.imageBytes);
}

/** ~0.8MB raw — trên mức này luôn nén lại trước khi POST (kể cả audio cũ IndexedDB). */
const COMPRESS_AUDIO_OVER_BYTES = 800_000;

function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType || "audio/mpeg" });
}

function blobToRawBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const raw = result.includes(",") ? result.split(",")[1] : result;
      if (!raw) reject(new Error("Không đọc được audio sau khi nén"));
      else resolve(raw);
    };
    reader.onerror = () => reject(reader.error || new Error("Đọc audio thất bại"));
    reader.readAsDataURL(blob);
  });
}

/** Lấy audio + nén speech MP3 nếu còn lớn (tránh timeout Flow2 create). */
async function collectAudioInputs(form: AudioImageToVideoFormState) {
  if (form.sourceTab !== "audio") return [];
  const source = (form.audioRefs || []).find((aud) => aud.audioBytes);
  if (!source?.audioBytes) return [];
  let audioBytes = stripToRawBase64(source.audioBytes);
  if (!audioBytes) return [];
  let mimeType = source.mimeType || "audio/mpeg";

  const approxBytes = Math.round((audioBytes.length * 3) / 4);
  if (approxBytes > COMPRESS_AUDIO_OVER_BYTES) {
    try {
      const { compressSpeechAudioInBrowser } = await import(
        /* webpackChunkName: "ffmpeg-browser" */
        "../../../video-affiliate-plus/ffmpeg-browser"
      );
      const beforeMb = (approxBytes / (1024 * 1024)).toFixed(1);
      console.info(`[audio-to-video] Nén audio trước khi gửi (~${beforeMb}MB)...`);
      const compressed = await compressSpeechAudioInBrowser(
        base64ToBlob(audioBytes, mimeType),
        {
          fileName: source.name || "audio.mp3",
          mimeType,
        }
      );
      const nextBytes = await blobToRawBase64(compressed.blob);
      const afterMb = (compressed.blob.size / (1024 * 1024)).toFixed(1);
      console.info(
        `[audio-to-video] Đã nén ${beforeMb}MB → ${afterMb}MB trước khi POST`
      );
      if (compressed.blob.size < approxBytes) {
        audioBytes = nextBytes;
        mimeType = compressed.mimeType;
      }
    } catch (err) {
      console.warn("[audio-to-video] Nén trước khi gửi thất bại, gửi bản gốc:", err);
    }
  }

  return [{ audioBytes, mimeType }];
}

function renumberScenes(scenes: AudioImageScene[]): AudioImageScene[] {
  return scenes.map((scene, index) => ({
    ...scene,
    sceneNumber: index + 1,
  }));
}

/** Nếu AI không trả timing — ước lượng ~8s/scene theo thứ tự. */
function ensureSceneTimings(scenes: AudioImageScene[]): AudioImageScene[] {
  const SCENE_SEC = 8;
  let cursor = 0;
  return scenes.map((scene) => {
    if (
      scene.startTime != null &&
      scene.endTime != null &&
      scene.endTime > scene.startTime
    ) {
      cursor = scene.endTime;
      return scene;
    }
    const startTime = cursor;
    const endTime = cursor + SCENE_SEC;
    cursor = endTime;
    return { ...scene, startTime, endTime };
  });
}

export function mapAudioImageScenesToScriptData(
  form: AudioImageToVideoFormState,
  scenes: AudioImageScene[]
): ScriptData {
  const timed = ensureSceneTimings(scenes);
  const mapped: SceneScript[] = timed.map((scene, index) => ({
    id: uid(),
    sceneNumber: scene.sceneNumber || index + 1,
    camera: "WIDE SHOT",
    visualPrompt: scene.visualPrompt,
    // IMAGE PROMPT UI / gen ảnh: chỉ visualPrompt, không gắn rule nền / no-text / style lock
    imageGenPrompt: (scene.visualPrompt || "").trim(),
    // Generate Video: motion sạch (không gắn rule nền); ảnh đầu/cuối gửi riêng mode component
    motionPrompt: ensureMotionStartsFromBlankPaper(scene.motionPrompt),
    dialogue: scene.dialogue,
    dialogueStartSec: scene.startTime,
    dialogueEndSec: scene.endTime,
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

const FLOW2_POLL_MS = 2500;
const FLOW2_TIMEOUT_MS = 30 * 60 * 1000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Poll trạng thái request Flow2 gen_text (GET /api/app/generate-text/:id/). */
async function waitForFlow2TextRequest(requestId: string): Promise<SourceToVideoApiResult> {
  const started = Date.now();
  let lastStatus = "";

  while (Date.now() - started < FLOW2_TIMEOUT_MS) {
    const res = await fetch(
      `/api/app/generate-text/${encodeURIComponent(requestId)}/?_=${Date.now()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          Pragma: "no-cache",
        },
        cache: "no-store",
      }
    );
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(payload?.message || `Lỗi poll Flow2 (${res.status})`);
    }

    const data = payload?.data || {};
    const status = String(data.status || "").toLowerCase();
    const result = data.result;
    if (status && status !== lastStatus) {
      console.info(`[audio-to-video] Flow2 poll ${requestId} status=${status}`);
      lastStatus = status;
    }

    const hasResult =
      !!result &&
      (typeof result.text === "string"
        ? result.text.length > 0
        : result.json != null);
    if (
      status === "done" ||
      status === "completed" ||
      status === "succeeded" ||
      status === "success" ||
      status === "finished" ||
      hasResult
    ) {
      if (!result) {
        throw new Error("Flow2 xong nhưng không có kết quả text");
      }
      return {
        data: {
          text: result.text,
          json: result.json,
        },
      };
    }

    if (status === "failed" || status === "cancelled" || status === "canceled" || status === "error") {
      throw new Error(data.error || `Flow2 ${status}`);
    }

    await sleep(FLOW2_POLL_MS);
  }

  throw new Error("Hết thời gian chờ Flow2 lấy text / phân tích");
}

async function callSourceToVideoApi(
  form: AudioImageToVideoFormState,
  phase: "transcribe" | "analyze",
  sourceText?: string
): Promise<SourceToVideoApiResult> {
  let body: Record<string, unknown>;

  if (phase === "transcribe" && form.sourceTab === "audio") {
    const audios = await collectAudioInputs(form);
    if (!audios.length) {
      throw new Error("Vui lòng upload file audio");
    }
    body = {
      phase,
      language: form.language || "Vietnamese",
      audios,
    };
  } else if (phase === "transcribe" && form.sourceTab === "image") {
    const images = collectImageInputs(form);
    if (!images.length) {
      throw new Error("Vui lòng upload ít nhất 1 ảnh");
    }
    body = {
      phase,
      language: form.language || "Vietnamese",
      images,
    };
  } else if (phase === "transcribe") {
    body = {
      phase,
      language: form.language || "Vietnamese",
      textContent: form.textContent || "",
    };
  } else {
    body = {
      phase,
      language: form.language,
      rhythm: form.rhythm,
      aspectRatio: form.aspectRatio,
      artStyle: form.artStyle,
      artStyleId: form.artStyleId,
      showDrawingHand: form.showDrawingHand,
      sourceText: sourceText || form.textContent || "",
    };
  }

  const res = await fetch(sourceApiPath(form.sourceTab), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const payload = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(payload?.message || `Lỗi API (${res.status})`);
  }

  if (payload?.data && !payload?.requestId) {
    return { data: payload.data };
  }

  const requestId = String(payload?.requestId || "").trim();
  if (!requestId) {
    throw new Error("API không trả requestId Flow2");
  }
  return waitForFlow2TextRequest(requestId);
}

/**
 * Step 1: lấy text từ audio / ảnh, hoặc dùng text có sẵn.
 * Audio → JSON timed segments. Image/text → plain text (timing do bước Phân tích ước lượng).
 */
export async function transcribeSourceText(
  form: AudioImageToVideoFormState
): Promise<string> {
  const invalid = validateAudioImageAnalyzeForm(form);
  if (invalid) {
    throw new Error(invalid);
  }

  if (form.sourceTab === "text") {
    const text = (form.textContent || "").trim();
    if (!text) throw new Error("Vui lòng nhập nội dung văn bản");
    return text;
  }

  const payload = await callSourceToVideoApi(form, "transcribe");

  if (form.sourceTab === "audio") {
    const { segments, plainFallback } = extractTimedTranscript(payload);
    if (segments.length) {
      return serializeTimedTranscript(segments);
    }
    if (plainFallback) return plainFallback;
    throw new Error("Không lấy được text từ audio");
  }

  const text = extractPlainText(payload);
  if (!text) {
    throw new Error("Không lấy được nội dung từ ảnh");
  }
  return text;
}

/** Step 2: phân tích text/object timed → scenes với visual/motion + timing. */
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

  return mapAudioImageScenesToScriptData(form, renumberScenes(scenes));
}
