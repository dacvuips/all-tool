/**
 * useAffiliateVideoApi.ts
 * Hook chứa tất cả các hàm gọi API cho module affiliate-video.
 */
import { useCallback } from "react";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  AffiliateVideoFormConfig,
  CACHE_KEY,
  CopyVideoAnalysisData,
  CopyVideoFormConfig,
  CopyVideoHistoryItem,
  DB_NAME,
  SceneHistoryItem,
  STORE_NAME,
} from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";

// ── Image generation store name ────────────────────────────────────────────
const IMAGE_STORE_NAME = "generated-images";
const VIDEO_STORE_NAME = "generated-videos";
const AUDIO_STORE_NAME = "generated-audio";

const COPY_VIDEO_STORE_NAME = "copy-video-scripts";

/** Max history entries kept in IndexedDB */
const MAX_SCENE_HISTORY = 50;
const MAX_COPY_VIDEO_HISTORY = 50;

// ── Types ──────────────────────────────────────────────────────────────────

export interface GenerateSceneFromTextParams {
  /** Đoạn text / prompt gửi trực tiếp đến API */
  text: string;
  /** Config (tuỳ chọn) – nếu không truyền sẽ dùng object rỗng */
  config?: Partial<AffiliateVideoFormConfig>;
}

export interface GenerateImageParams {
  /** Scene ID – dùng làm key lưu vào IndexedDB */
  sceneId: string;
  /** Image generation prompt (scene.imageGenPrompt) */
  prompt: string;
  /** Aspect ratio (tuỳ chọn) */
  aspectRatio?: string;
  /** Ảnh tham chiếu (base64) gửi kèm prompt để AI tham khảo */
  referenceImage?: { imageBytes: string; mimeType: string };
  /** Ảnh tham chiếu bổ sung (e.g., ảnh sản phẩm được chọn) */
  additionalImages?: { imageBytes: string; mimeType: string }[];
  /** URL ảnh sản phẩm gốc – truyền lên server để inject vào prompt */
  productImages?: string[];
  /** Custom prompt cho product images – nếu có sẽ dùng thay prompt mặc định */
  productImagePrompt?: string;
  /** Callback nhận progress 0-100 */
  onProgress?: (pct: number) => void;
  noText?: boolean;
}

export interface GenerateVideoParams {
  /** Scene ID – dùng làm key lưu vào IndexedDB */
  sceneId: string;
  /** Video generation prompt (scene.motionPrompt hoặc scene.imageGenPrompt) */
  prompt: string;
  /** Optional images to use for image-to-video (URLs or base64 objects) */
  images?: Array<
    | string // URL ảnh
    | { imageBytes: string; mimeType?: string } // base64
  >;
  /** Aspect ratio (tuỳ chọn) */
  aspectRatio?: string;
  /** Generate audio (tuỳ chọn, default true) */
  generateAudio?: boolean;
  /** Callback nhận progress 0-100 */
  onProgress?: (pct: number) => void;
  /** Callback nhận status message */
  onStatusMessage?: (msg: string) => void;
}

export interface ExtendVideoParams {
  /** Scene ID – dùng làm key lưu vào IndexedDB */
  sceneId: string;
  /** Prompt mô tả cảnh nối tiếp */
  prompt?: string;
  /** Video gốc cần nối */
  video: { uri?: string | null; videoBytes?: string | null; mimeType: string };
  /** Ảnh tham chiếu của scene kế tiếp (để hướng dẫn nối) */
  image?: { imageBytes: string; mimeType: string };
  /** Aspect ratio (tuỳ chọn) */
  aspectRatio?: string;
  /** Generate audio (tuỳ chọn, default true) */
  generateAudio?: boolean;
  /** Callback nhận progress 0-100 */
  onProgress?: (pct: number) => void;
  /** Callback nhận status message */
  onStatusMessage?: (msg: string) => void;
}

export interface InsertSceneParams {
  /** Mô tả nội dung scene mới */
  description: string;
  /** Voiceover / lời thoại gợi ý (tùy chọn) */
  voiceover?: string;
  /** Góc máy yêu cầu (tùy chọn) */
  camera?: string;
  /** Selected character IDs (tùy chọn) */
  selectedCharacters?: string[];
  /** Scene number mới */
  sceneNumber: number;
  /** Scene trước (nếu insert below) */
  prevScene?: any;
  /** Scene sau (nếu insert above) */
  nextScene?: any;
  /** ScriptData context – để lấy character, environment, artStyle */
  scriptContext?: {
    cast?: { name: string; tag: string; description: string }[];
    environment?: string;
    artStyle?: string;
    audioPrompt?: string;
    voiceGender?: string;
    voiceTone?: string;
    language?: string;
    characterDna?: string;
  };
}

export interface InsertSceneResult {
  sceneNumber: number;
  imagePrompt: string;
  motionPrompt: string;
  visualPrompt: string;
  audio: string;
  camera: string;
  dialogue: string;
}

export interface InsertCopyVideoSceneParams {
  /** Mô tả nội dung scene mới */
  description: string;
  /** Voiceover / lời thoại gợi ý (tùy chọn) */
  voiceover?: string;
  /** Góc máy yêu cầu (tùy chọn) */
  camera?: string;
  /** Selected character IDs (tùy chọn) */
  selectedCharacters?: string[];
  /** Scene number mới */
  sceneNumber: number;
  /** Scene trước (nếu insert below) */
  prevScene?: any;
  /** Scene sau (nếu insert above) */
  nextScene?: any;
  /** ScriptData context – để lấy character, environment, artStyle */
  scriptContext?: {
    cast?: { name: string; tag: string; description: string }[];
    environment?: string;
    artStyle?: string;
    audioPrompt?: string;
    voiceGender?: string;
    voiceTone?: string;
    language?: string;
    characterDna?: string;
  };
}

export interface SuggestConfigParams {
  /** Danh mục hiện tại (tuỳ chọn) */
  category?: string;
  /** Mood hiện tại (tuỳ chọn) */
  mood?: string;
  /** Ngôn ngữ (tuỳ chọn) */
  language?: string;
}

export interface SuggestConfigResult {
  objectToPersonify: string;
  tipContent: string;
}

export interface GenerateAudioTTSParams {
  /** Unique key to store audio (e.g. "voice-export-{timestamp}") */
  cacheKey: string;
  /** The dialogue / text content to convert to speech */
  text: string;
  /** Voice name (e.g. "Kore", "Puck", "Aoede") */
  voiceName?: string;
  /** Style/tone instructions (e.g. "Read cheerfully") */
  stylePrompt?: string;
}

export interface GeneratedAudioData {
  audioBytes: string; // base64 WAV
  mimeType: string;
  sampleRate?: number;
  durationMs?: number;
}

export interface GeneratedImageData {
  imageBytes: string; // base64
  mimeType: string;
  fifeUrl: string;
}

export interface GeneratedVideoData {
  videoUri: string | null;
  videoBytes: string | null; // base64 – returned when no outputGcsUri is set
  mimeType: string;
  /** Aspect ratio used when this video was generated (e.g. "9:16", "16:9") */
  aspectRatio?: string;
}

export interface UseAffiliateVideoApiReturn {
  /**
   * Gọi API tạo ảnh từ imageGenPrompt.
   * Lưu kết quả base64 vào IndexedDB theo sceneId.
   */
  copyVideoGenerateImage: (params: GenerateImageParams) => Promise<GeneratedImageData | undefined>;

  /**
   * Lấy ảnh đã tạo từ IndexedDB theo sceneId.
   */
  getGeneratedImage: (sceneId: string) => Promise<GeneratedImageData | undefined>;

  /**
   * Lưu ảnh trực tiếp vào IndexedDB (upload từ máy hoặc chọn từ gallery).
   */
  saveGeneratedImage: (sceneId: string, imageData: GeneratedImageData) => Promise<void>;

  /**
   * Gọi API tạo video từ prompt (Veo 3.1 fast).
   * Sử dụng SSE để nhận progress từ server.
   * Lưu kết quả vào IndexedDB theo sceneId.
   */
  generateVideo: (params: GenerateVideoParams) => Promise<GeneratedVideoData | undefined>;

  /**
   * Lấy video đã tạo từ IndexedDB theo sceneId.
   */
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoData | undefined>;

  /**
   * Gọi API chèn scene mới giữa 2 scene.
   * Trả về scene data đã được AI generate.
   */
  insertScene: (params: InsertSceneParams) => Promise<InsertSceneResult | undefined>;

  /**
   * Gọi API gợi ý objectToPersonify và tipContent từ AI.
   */
  suggestConfig: (params: SuggestConfigParams) => Promise<SuggestConfigResult | undefined>;

  /**
   * Gọi API tạo audio từ text (TTS) bằng Gemini.
   * Lưu kết quả WAV vào IndexedDB.
   */
  generateAudioTTS: (params: GenerateAudioTTSParams) => Promise<GeneratedAudioData | undefined>;

  /**
   * Lấy audio đã tạo từ IndexedDB theo cacheKey.
   */
  getGeneratedAudio: (cacheKey: string) => Promise<GeneratedAudioData | undefined>;

  /**
   * Lấy toàn bộ lịch sử generate scene từ IndexedDB.
   */
  getSceneHistory: () => Promise<SceneHistoryItem[]>;

  /**
   * Xóa toàn bộ lịch sử generate scene.
   */
  clearSceneHistory: () => Promise<void>;

  /**
   * Gọi API phân tích video gốc (copy-video flow).
   * Gửi video base64 lên server → Gemini phân tích → trả về characters, props, scenes.
   * Tự động lưu kết quả vào IndexedDB.
   */
  analyzeVideoForCopy: (data: CopyVideoFormConfig) => Promise<CopyVideoAnalysisData | undefined>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useCopyVideoApi(): UseAffiliateVideoApiReturn {
  const toast = useToast();
  const { STORY_MODE_OPTIONS } = useOptionsTranslation();
  const scriptDB = useIndexedDB<any>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const imageDB = useIndexedDB<GeneratedImageData>(IMAGE_STORE_NAME, DB_NAME.generateImage);
  const videoDB = useIndexedDB<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);
  const audioDB = useIndexedDB<GeneratedAudioData>(AUDIO_STORE_NAME, DB_NAME.generateVoice);
  const copyVideoScriptDB = useIndexedDB<any>(COPY_VIDEO_STORE_NAME, DB_NAME.copyVideo);
  const { customer } = useAuth();

  // ── Shared: gọi API /api/app/copy-video-analysis/ ──
  const callCopyVideoAnalysisApi = useCallback(
    async (body: {
      videoBase64: string;
      mimeType: string;
      artStyle?: string;
      language?: string;
      mood?: string;
      aspectRatio?: string;
      productImages?: string[];
      objectToPersonifyCode?: string;
    }) => {
      const res = await fetch("/api/app/copy-video-analysis/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err?.message || `Lỗi ${res.status}`;
        toast.error(message);
        return undefined;
      }

      return res.json();
    },
    [toast]
  );

  // ── Helper: push a CopyVideoAnalysisData into history array in IndexedDB ──
  const pushToCopyVideoHistory = useCallback(
    async (analysisResult: CopyVideoAnalysisData) => {
      try {
        const existing: CopyVideoHistoryItem[] =
          (await copyVideoScriptDB.get(CACHE_KEY.copyVideoHistory)) || [];

        const now = new Date();
        const label = `Phân tích video – ${now.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        })} ${now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const newItem: CopyVideoHistoryItem = {
          id: crypto.randomUUID(),
          createdAt: now.getTime(),
          label,
          data: analysisResult,
        };

        const updated = [newItem, ...existing].slice(0, MAX_COPY_VIDEO_HISTORY);
        await copyVideoScriptDB.set(CACHE_KEY.copyVideoHistory, updated);
      } catch (e) {
        console.warn("[affiliate-video-api] Failed to push copy-video history", e);
      }
    },
    [copyVideoScriptDB]
  );

  // ── analyzeVideoForCopy (copy-video flow – phân tích video gốc) ──
  const analyzeVideoForCopy = useCallback(
    async (data: CopyVideoFormConfig): Promise<CopyVideoAnalysisData | undefined> => {
      if (!data.sourceVideo?.base64) {
        toast.error("Chưa upload video gốc");
        return undefined;
      }

      const result = await callCopyVideoAnalysisApi({
        videoBase64: data.sourceVideo.base64,
        mimeType: data.sourceVideo.mimeType,
        artStyle: data.artStyle,
        language: data.language,
        mood: data.mood,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
        objectToPersonifyCode: data.objectToPersonify?.trim() ? data.objectToPersonifyCode : undefined,
      });
      if (!result) return undefined;

      const analysisResult: CopyVideoAnalysisData = {
        ...result.data,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
      };

      // Gán id ngẫu nhiên cho từng scene mới
      if (analysisResult?.scenes) {
        analysisResult.scenes = analysisResult.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
        }));
      }

      // Persist config input
      copyVideoScriptDB
        .set(CACHE_KEY.copyVideoInput, data)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      // Persist analysis result
      copyVideoScriptDB
        .set(CACHE_KEY.lastCopyVideoScript, analysisResult)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      // Push to history
      await pushToCopyVideoHistory(analysisResult);

      return analysisResult;
    },
    [callCopyVideoAnalysisApi, copyVideoScriptDB, pushToCopyVideoHistory, toast]
  );

  // ── generateImage – gọi API tạo ảnh từ prompt ──
  const copyVideoGenerateImage = useCallback(
    async (params: GenerateImageParams): Promise<GeneratedImageData | undefined> => {
      const {
        sceneId,
        prompt,
        aspectRatio = "9:16",
        referenceImage,
        additionalImages,
        productImages,
        productImagePrompt,
        onProgress,
        noText = false,
      } = params;

      // ── Simulated progress: random start 1-10% → 99% over 2 minutes ──
      const DURATION_MS = 2 * 60 * 1000; // 2 minutes
      const INTERVAL_MS = 500; // update every 500ms
      const startPct = Math.floor(Math.random() * 10) + 1; // 1-10
      const endPct = 99;
      const totalSteps = DURATION_MS / INTERVAL_MS;
      const increment = (endPct - startPct) / totalSteps;
      let currentPct = startPct;

      onProgress?.(currentPct);

      const progressTimer = setInterval(() => {
        currentPct += increment;
        if (currentPct >= endPct) {
          currentPct = endPct;
          clearInterval(progressTimer);
        }
        onProgress?.(Math.round(currentPct));
      }, INTERVAL_MS);

      try {
        // Build images array from referenceImage + additionalImages
        const images: { imageBytes: string; mimeType: string }[] = [];
        if (referenceImage) {
          images.push({ imageBytes: referenceImage.imageBytes, mimeType: referenceImage.mimeType });
        }
        if (additionalImages?.length) {
          images.push(...additionalImages);
        }

        const res = await fetch("/api/app/copy-video-generate-image/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            images: images.length > 0 ? images : undefined,
            productImages: productImages?.length ? productImages : undefined,
            productImagePrompt: productImagePrompt || undefined,
            config: { numberOfImages: 1, aspectRatio },
            noText: noText,
          }),
        });

        if (!res.ok) {
          clearInterval(progressTimer);
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          return undefined;
        }

        const result = await res.json();

        // Handle both formats: direct array [...] or wrapped { data: [...] }
        const resultImages: GeneratedImageData[] = Array.isArray(result)
          ? result
          : Array.isArray(result.data)
          ? result.data
          : [];

        if (resultImages.length === 0) {
          clearInterval(progressTimer);
          toast.error("Không nhận được ảnh từ API");
          return undefined;
        }

        const imageData = resultImages[0];

        // Persist to IndexedDB
        await imageDB.set(sceneId, imageData);

        // Stop simulated progress and jump to 100%
        clearInterval(progressTimer);
        onProgress?.(100);

        return imageData;
      } catch (err: any) {
        clearInterval(progressTimer);
        onProgress?.(0);
        console.error("[generateImage] Error:", err);
      }
    },
    [toast, imageDB]
  );

  // ── getGeneratedImage – lấy ảnh đã tạo từ IndexedDB ──
  const getGeneratedImage = useCallback(
    async (sceneId: string): Promise<GeneratedImageData | undefined> => {
      return imageDB.get(sceneId);
    },
    [imageDB]
  );

  // ── saveGeneratedImage – lưu ảnh trực tiếp vào IndexedDB ──
  const saveGeneratedImage = useCallback(
    async (sceneId: string, imageData: GeneratedImageData): Promise<void> => {
      await imageDB.set(sceneId, imageData);
    },
    [imageDB]
  );

  // ── generateVideo – gọi API tạo video từ prompt (SSE) ──
  const generateVideo = useCallback(
    async (params: GenerateVideoParams): Promise<GeneratedVideoData | undefined> => {
      const {
        sceneId,
        prompt,
        images,
        aspectRatio = "9:16",
        generateAudio = true,
        onProgress,
        onStatusMessage,
      } = params;

      try {
        onProgress?.(5);
        onStatusMessage?.("Đang gửi yêu cầu tạo video...");

        const res = await fetch("/api/app/generation-video/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            images,
            config: { aspectRatio, generateAudio },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          return undefined;
        }

        // Read SSE stream
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          toast.error("Không thể đọc response stream");
          return undefined;
        }

        let videoData: GeneratedVideoData | undefined;
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // keep incomplete line

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            try {
              const event = JSON.parse(line.slice(6));

              if (event.type === "progress") {
                onProgress?.(event.progress);
                if (event.message) onStatusMessage?.(event.message);
              } else if (event.type === "done") {
                onProgress?.(100);
                onStatusMessage?.("Hoàn thành!");
                videoData = event.data;
              } else if (event.type === "error") {
                toast.error(event.message || "Lỗi tạo video");
                throw new Error(event.message);
              }
            } catch (parseErr) {
              // Ignore malformed SSE lines
            }
          }
        }

        if (!videoData) {
          toast.error("Không nhận được video từ API");
          return undefined;
        }

        // Attach the aspect ratio used at generation time
        videoData.aspectRatio = aspectRatio;
        // Persist to IndexedDB
        await videoDB.set(sceneId, videoData);

        return videoData;
      } catch (err: any) {
        onProgress?.(0);
        console.error("[generateVideo] Error:", err);
      }
    },
    [toast, videoDB]
  );

  // ── getGeneratedVideo – lấy video đã tạo từ IndexedDB ──
  const getGeneratedVideo = useCallback(
    async (sceneId: string): Promise<GeneratedVideoData | undefined> => {
      return videoDB.get(sceneId);
    },
    [videoDB]
  );

  // ── insertScene – gọi API chèn scene mới ──
  const insertScene = useCallback(
    async (params: InsertSceneParams): Promise<InsertSceneResult | undefined> => {
      const { description, voiceover, camera, sceneNumber, prevScene, nextScene, scriptContext } =
        params;

      try {
        const res = await fetch("/api/app/insert-scene/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            description,
            voiceover,
            camera,
            sceneNumber,
            prevScene,
            nextScene,
            cast: scriptContext?.cast,
            environment: scriptContext?.environment,
            artStyle: scriptContext?.artStyle,
            audioPrompt: scriptContext?.audioPrompt,
            voiceGender: scriptContext?.voiceGender,
            voiceTone: scriptContext?.voiceTone,
            language: scriptContext?.language,
            characterDna: scriptContext?.characterDna,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          return undefined;
        }

        const result = await res.json();
        return result.data as InsertSceneResult;
      } catch (err: any) {
        console.error("[insertScene] Error:", err);
      }
    },
    [toast]
  );

  // ── suggestConfig – gọi API gợi ý objectToPersonify & tipContent ──
  const suggestConfig = useCallback(
    async (params: SuggestConfigParams): Promise<SuggestConfigResult | undefined> => {
      try {
        const res = await fetch("/api/app/suggest-config/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            category: params.category,
            mood: params.mood,
            language: params.language,
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          return undefined;
        }

        const result = await res.json();
        return result.data as SuggestConfigResult;
      } catch (err: any) {
        console.error("[suggestConfig] Error:", err);
      }
    },
    [toast]
  );

  // ── generateTTS – gọi API tạo audio từ text (Gemini TTS) ──
  const generateAudioTTS = useCallback(
    async (params: GenerateAudioTTSParams): Promise<GeneratedAudioData | undefined> => {
      const { cacheKey, text, voiceName, stylePrompt } = params;

      try {
        const res = await fetch("/api/app/generation-audio-tts/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text, voiceName, stylePrompt }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          return undefined;
        }

        const result = await res.json();
        const audioData: GeneratedAudioData = result.data;

        if (!audioData?.audioBytes) {
          toast.error("Không nhận được audio từ API");
          return undefined;
        }

        // Persist to IndexedDB
        await audioDB.set(cacheKey, audioData);

        return audioData;
      } catch (err: any) {
        console.error("[generateAudioTTS] Error:", err);
      }
    },
    [toast, audioDB]
  );

  // ── getGeneratedAudio – lấy audio đã tạo từ IndexedDB ──
  const getGeneratedAudio = useCallback(
    async (cacheKey: string): Promise<GeneratedAudioData | undefined> => {
      return audioDB.get(cacheKey);
    },
    [audioDB]
  );

  // ── getSceneHistory – lấy lịch sử generate scene ──
  const getSceneHistory = useCallback(async (): Promise<SceneHistoryItem[]> => {
    if (!customer?._id) return [];
    try {
      return (await scriptDB.get(CACHE_KEY.sceneHistory)) || [];
    } catch {
      return [];
    }
  }, [scriptDB, customer?._id]);

  // ── clearSceneHistory – xóa toàn bộ lịch sử ──
  const clearSceneHistory = useCallback(async (): Promise<void> => {
    if (!customer?._id) return;
    await scriptDB.set(CACHE_KEY.sceneHistory, []);
  }, [scriptDB, customer?._id]);

  return {
    copyVideoGenerateImage,
    getGeneratedImage,
    saveGeneratedImage,
    generateVideo,
    getGeneratedVideo,
    insertScene,
    suggestConfig,
    generateAudioTTS,
    getGeneratedAudio,
    getSceneHistory,
    clearSceneHistory,
    analyzeVideoForCopy,
  };
}
