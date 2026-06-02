/**
 * useAffiliateVideoApi.ts
 * Hook chứa tất cả các hàm gọi API cho module affiliate-video.
 */
import { useCallback } from "react";
import { useMediaGenerationJob } from "../../../../../lib/hooks/useMediaGenerationJob";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { AffiliateVideoFormConfig, CACHE_KEY, DB_NAME, SceneHistoryItem } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import {
  ReviewAnalysisData,
  ReviewFormImage,
  ReviewHistoryItem,
  ServiceImageEnum,
} from "../constants";
import {
  hasObjectToPersonifyImage,
  objectToPersonifyImageToApiImages,
  stripDataUrlFromImageBytes,
} from "../utils/reviewFormImageUtils";

// ── Image generation store name ────────────────────────────────────────────
const IMAGE_STORE_NAME = "generated-images";
const VIDEO_STORE_NAME = "generated-videos";
const AUDIO_STORE_NAME = "generated-audio";

const REVIEW_STORE_NAME = "generate-review";

/** Max history entries kept in IndexedDB */
const MAX_SCENE_HISTORY = 50;
const MAX_REVIEW_HISTORY = 50;

// ── Types ──────────────────────────────────────────────────────────────────

export interface GenerateSceneFromTextParams {
  /** Đoạn text / prompt gửi trực tiếp đến API */
  text: string;
  /** Config (tuỳ chọn) – nếu không truyền sẽ dùng object rỗng */
  config?: Partial<AffiliateVideoFormConfig>;
}
export interface GenerateReviewFromTextParams {
  /** Config review (tuỳ chọn) */
  config: Record<string, any>;
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
  /** Báo lỗi inline thay vì toast (scene batch row) */
  onError?: (message: string) => void;
  noText?: boolean;
  artStyleId?: string;
  artStyle?: string;
  serviceImageType?: ServiceImageEnum;
  objectToPersonifyImage?: ReviewFormImage;
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
  /** Báo lỗi inline thay vì toast (scene batch row) */
  onError?: (message: string) => void;
  artStyleId?: string;
  artStyle?: string;
  serviceImageType?: ServiceImageEnum;
}
export interface GenerateVideoToVideoParams extends GenerateVideoParams {
  /** Video gốc cần nối (base64) */
  video?: { uri?: string | null; videoBytes?: string | null; mimeType: string };
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
  /** URL trực tiếp — fallback khi server không fetch được binary từ fifeUrl */
  imageUrl?: string;
}

export interface GeneratedVideoData {
  videoUri: string | null;
  videoBytes: string | null; // base64 – returned when no outputGcsUri is set
  mimeType: string;
  /** Aspect ratio used when this video was generated (e.g. "9:16", "16:9") */
  aspectRatio?: string;
  artStyleId?: string;
  artStyle?: string;
}

export interface UseAffiliateVideoApiReturn {
  /**
   * Gọi API tạo scenes cho review từ prompt text.
   */
  generateReview: (params: GenerateReviewFromTextParams) => Promise<ReviewAnalysisData | undefined>;

  /**
   * Gọi API tạo ảnh từ imageGenPrompt.
   * Lưu kết quả base64 vào IndexedDB theo sceneId.
   */
  reviewGenerateImage: (params: GenerateImageParams) => Promise<GeneratedImageData | undefined>;

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

  generateVideoToVideo: (
    params: GenerateVideoToVideoParams
  ) => Promise<GeneratedVideoData | undefined>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useReviewApi(): UseAffiliateVideoApiReturn {
  const toast = useToast();
  const { STORY_MODE_OPTIONS } = useOptionsTranslation();
  const scriptDB = useIndexedDB<any>(REVIEW_STORE_NAME, DB_NAME.generateReview);
  const imageDB = useIndexedDB<GeneratedImageData>(IMAGE_STORE_NAME, DB_NAME.generateImage);
  const videoDB = useIndexedDB<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);
  const audioDB = useIndexedDB<GeneratedAudioData>(AUDIO_STORE_NAME, DB_NAME.generateVoice);
  const reviewScriptDB = useIndexedDB<any>(REVIEW_STORE_NAME, DB_NAME.generateReview);
  const { customer } = useAuth();

  // Hook chung cho mọi lệnh tạo media (job + subscription + poll fallback)
  const imageJob = useMediaGenerationJob<{ images: GeneratedImageData[] }>();
  const videoJob = useMediaGenerationJob<GeneratedVideoData>();

  // ── Shared: gọi API /api/app/generation-review-image/ (tạo kịch bản cảnh từ config) ──
  const callGenerationReviewApi = useCallback(
    async (body: { config: Record<string, any> }) => {
      const res = await fetch("/api/app/generation-review-scene/", {
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
  const pushToReviewHistory = useCallback(
    async (analysisResult: ReviewAnalysisData) => {
      try {
        const existing: ReviewHistoryItem[] =
          (await reviewScriptDB.get(CACHE_KEY.reviewHistory)) || [];

        const now = new Date();
        const label = `Phân tích video – ${now.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        })} ${now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const newItem: ReviewHistoryItem = {
          id: crypto.randomUUID(),
          createdAt: now.getTime(),
          label,
          data: analysisResult,
        };

        const updated = [newItem, ...existing].slice(0, MAX_REVIEW_HISTORY);
        await reviewScriptDB.set(CACHE_KEY.reviewHistory, updated);
      } catch (e) {
        console.warn("[affiliate-video-api] Failed to push review history", e);
      }
    },
    [reviewScriptDB]
  );

  // ── generateReviewFromText – gọi backend review bằng prompt text ──
  const generateReview = useCallback(
    async (params: GenerateReviewFromTextParams): Promise<ReviewAnalysisData | undefined> => {
      const { config = {} } = params;

      const result = await callGenerationReviewApi({ config });
      if (!result?.data) return undefined;

      const reviewResult: ReviewAnalysisData = {
        ...result.data,
        scenes: Array.isArray(result.data?.scenes)
          ? result.data.scenes.map((scene) => ({
              ...scene,
              id: scene?.id || crypto.randomUUID(),
              disabled: scene?.disabled ?? false,
              voiceDisable: scene?.voiceDisable ?? false,
            }))
          : [],
        objectToPersonifyCode: config.objectToPersonify?.trim()
          ? config.objectToPersonifyCode
          : undefined,
        objectToPersonifyImage: hasObjectToPersonifyImage(config.objectToPersonifyImage)
          ? config.objectToPersonifyImage
          : undefined,
        aspectRatio: config.aspectRatio ?? result.data?.aspectRatio,
        artStyleId: config.artStyleId ?? result.data?.artStyleId,
        artStyle: config.artStyle ?? result.data?.artStyle,
        serviceImageType: config.serviceImageType ?? result.data?.serviceImageType,
      };

      reviewScriptDB
        .set(CACHE_KEY.lastReviewScript, reviewResult)
        .catch((e) => console.warn("[review-api] IndexedDB write error", e));
      await pushToReviewHistory(reviewResult);

      return reviewResult;
    },
    [callGenerationReviewApi, reviewScriptDB, pushToReviewHistory]
  );

  // ── generateImage – tạo Job, subscribe progress, trả về ảnh ──
  const reviewGenerateImage = useCallback(
    async (params: GenerateImageParams): Promise<GeneratedImageData | undefined> => {
      const {
        sceneId,
        prompt,
        aspectRatio,
        referenceImage,
        additionalImages,
        productImages,
        productImagePrompt,
        objectToPersonifyImage,
        onProgress,
        onError,
        noText = false,
        artStyleId,
        artStyle,
      } = params;

      // Gom ảnh tham chiếu (reference + additional) — base64 thuần, không data URL
      const images: { imageBytes: string; mimeType: string }[] = [];
      if (referenceImage) {
        images.push(stripDataUrlFromImageBytes(referenceImage.imageBytes, referenceImage.mimeType));
      }
      if (additionalImages?.length) {
        images.push(
          ...additionalImages.map((img) =>
            stripDataUrlFromImageBytes(img.imageBytes, img.mimeType || "image/png")
          )
        );
      }

      try {
        const personifyApiImages = hasObjectToPersonifyImage(objectToPersonifyImage)
          ? await objectToPersonifyImageToApiImages(objectToPersonifyImage)
          : [];

        onProgress?.(1);
        const { data } = await imageJob.run({
          url: "/api/app/generation-review-image/",
          body: {
            prompt,
            images: images.length > 0 ? images : undefined,
            objectToPersonifyImages: personifyApiImages.length ? personifyApiImages : undefined,
            productImages: productImages?.length ? productImages : undefined,
            productImagePrompt: productImagePrompt || undefined,
            noText,
            aspectRatio,
            artStyleId,
            artStyle,
            _metadata: { sceneId },
          },
          onProgress: (pct) => onProgress?.(pct),
        });

        const resultImages = (data?.images || []) as GeneratedImageData[];
        if (resultImages.length === 0) {
          const message = "Không nhận được ảnh từ API";
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        const imageData = resultImages[0];
        await imageDB.set(sceneId, imageData);
        onProgress?.(100);
        return imageData;
      } catch (err: any) {
        onProgress?.(0);
        const message = err?.message || "Lỗi tạo ảnh";
        if (onError) onError(message);
        else console.error(message);
        console.error("[generateImage] Error:", err);
        return undefined;
      }
    },
    [imageJob, imageDB]
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

  // ── generateVideo – tạo Job, theo dõi, trả video ──
  const generateVideo = useCallback(
    async (params: GenerateVideoParams): Promise<GeneratedVideoData | undefined> => {
      const {
        sceneId,
        prompt,
        images,
        aspectRatio,
        generateAudio,
        onProgress,
        onStatusMessage,
        onError,
        artStyleId,
        artStyle,
        serviceImageType,
      } = params;

      try {
        onProgress?.(1);
        onStatusMessage?.("Đang gửi yêu cầu tạo video...");

        const { data } = await videoJob.run({
          url: "/api/app/generation-element-video/",
          body: {
            prompt,
            images,
            config: { aspectRatio, generateAudio, artStyleId, artStyle, serviceImageType },
            _metadata: { sceneId },
          },
          onProgress: (pct) => onProgress?.(pct),
          onStatusMessage: (msg) => onStatusMessage?.(msg),
        });

        if (!data) {
          const message = "Không nhận được video từ API";
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        const videoData: GeneratedVideoData = { ...data, aspectRatio };
        await videoDB.set(sceneId, videoData);
        onProgress?.(100);
        onStatusMessage?.("Hoàn thành!");
        return videoData;
      } catch (err: any) {
        onProgress?.(0);
        const message = err?.message || "Lỗi tạo video";
        if (onError) onError(message);
        else console.error(message);
        console.error("[generateVideo] Error:", err);
        return undefined;
      }
    },
    [videoJob, videoDB]
  );

  // ── getGeneratedVideo – lấy video đã tạo từ IndexedDB ──
  const getGeneratedVideo = useCallback(
    async (sceneId: string): Promise<GeneratedVideoData | undefined> => {
      return videoDB.get(sceneId);
    },
    [videoDB]
  );

  // ── generateVideoToVideo – tạo Job video-to-video ──
  const generateVideoToVideo = useCallback(
    async (params: GenerateVideoToVideoParams): Promise<GeneratedVideoData | undefined> => {
      const {
        sceneId,
        prompt,
        images,
        aspectRatio,
        generateAudio,
        onProgress,
        onStatusMessage,
        onError,
        artStyleId,
        artStyle,
        serviceImageType,
        video,
      } = params;

      try {
        onProgress?.(1);
        onStatusMessage?.("Đang gửi yêu cầu tạo video...");

        const { data } = await videoJob.run({
          url: "/api/app/generation-element-video-to-video/",
          body: {
            prompt,
            images,
            video,
            config: { aspectRatio, generateAudio, artStyleId, artStyle, serviceImageType },
            _metadata: { sceneId },
          },
          onProgress: (pct) => onProgress?.(pct),
          onStatusMessage: (msg) => onStatusMessage?.(msg),
        });

        const videoData = data as GeneratedVideoData | undefined;
        if (!videoData) {
          const message = "Không nhận được video từ API";
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        videoData.aspectRatio = aspectRatio;
        await videoDB.set(sceneId, videoData);
        onProgress?.(100);
        onStatusMessage?.("Hoàn thành!");
        return videoData;
      } catch (err: any) {
        onProgress?.(0);
        const message = err?.message || "Lỗi tạo video";
        if (onError) onError(message);
        else console.error(message);
        console.error("[generateVideoToVideo] Error:", err);
        return undefined;
      }
    },
    [videoJob, videoDB]
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
    generateReview,
    reviewGenerateImage,
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
    generateVideoToVideo,
  };
}
