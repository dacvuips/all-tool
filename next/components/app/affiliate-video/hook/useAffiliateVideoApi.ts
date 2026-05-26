/**
 * useAffiliateVideoApi.ts
 * Hook chứa tất cả các hàm gọi API cho module affiliate-video.
 */
import { useCallback } from "react";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  ArtStyleCategoryPublicItem,
  ArtStyleCategoryService,
  ArtStylesByCategoryResult,
  CustomerArtStyleInput,
} from "../../../../lib/repo/list/artStyleCategory.repo";
import {
  CustomerTrendingInput,
  TrendingCategoryPublicItem,
  TrendingCategoryService,
  TrendingsByCategoryResult,
} from "../../../../lib/repo/list/trendingCategory.repo";
import {
  consumeGenerationResponse,
  extractGeneratedImages,
} from "../shared/read-generation-sse";
import {
  AffiliateVideoFormConfig,
  CACHE_KEY,
  CopyVideoAnalysisData,
  CopyVideoFormConfig,
  CopyVideoHistoryItem,
  DB_NAME,
  ElementFormImage,
  SceneHistoryItem,
  ScriptData,
  STORE_NAME,
  TrendingHistoryItem,
  TrendingScriptData,
  TrendingVideoFormConfig,
} from "../constants";
import {
  buildObjectToPersonifyApiFields,
  getObjectToPersonifyMode,
  hasObjectToPersonifyImage,
  objectToPersonifyImageToApiImages,
  stripObjectToPersonifyPromptFromConfig,
} from "../elements/utils/elementFormImageUtils";
import { useIndexedDB } from "./useIndexedDB";

// ── Image generation store name ────────────────────────────────────────────
const IMAGE_STORE_NAME = "generated-images";
const VIDEO_STORE_NAME = "generated-videos";
const AUDIO_STORE_NAME = "generated-audio";

const COPY_VIDEO_STORE_NAME = "copy-video-scripts";

/** Max history entries kept in IndexedDB */
const MAX_SCENE_HISTORY = 50;
const MAX_COPY_VIDEO_HISTORY = 50;

// ── Types ──────────────────────────────────────────────────────────────────

/** Public object to personify item (no prompt field) */
export interface ObjectToPersonifyPublic {
  id: string;
  name: string;
  imageUrl: string;
  code: string;
  isActive: boolean;
}

/** Public trending types – re-exported from repo */
export type {
  CustomerTrendingInput,
  TrendingCategoryPublicItem,
  TrendingPublicItem,
  TrendingsByCategoryResult,
} from "../../../../lib/repo/list/trendingCategory.repo";

/** Public art style types – re-exported from repo */
export type {
  ArtStyleCategoryPublicItem,
  ArtStylePublicItem,
  ArtStylesByCategoryResult,
  CustomerArtStyleInput,
} from "../../../../lib/repo/list/artStyleCategory.repo";

export interface GenerateSceneFromTextParams {
  /** Đoạn text / prompt gửi trực tiếp đến API */
  text: string;
  /** Config (tuỳ chọn) – nếu không truyền sẽ dùng object rỗng */
  config?: Partial<AffiliateVideoFormConfig>;
}
export interface GenerateTrendingParams {
  /** Đoạn text / prompt gửi trực tiếp đến API */
  /** Config (tuỳ chọn) – nếu không truyền sẽ dùng object rỗng */
  config?: Partial<TrendingScriptData>;
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
  /** URL ảnh tham chiếu nhân hoá đồ vật */
  objectToPersonifyImage?: ElementFormImage;
  /** Custom prompt cho product images – nếu có sẽ dùng thay prompt mặc định */
  productImagePrompt?: string;
  /** Bật/tắt text (watermark/chữ) trong ảnh tạo ra */
  noText?: boolean;
  /** Callback nhận progress 0-100 */
  onProgress?: (pct: number) => void;
  /** Báo lỗi inline thay vì toast (scene batch row) */
  onError?: (message: string) => void;
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
   * Gọi API tạo scene từ config form (flow cũ).
   * Tự động lưu kết quả vào IndexedDB.
   */
  generateScene: (data: AffiliateVideoFormConfig) => Promise<ScriptData | undefined>;

  /**
   * Gọi API tạo scene bằng đoạn text / prompt tự do.
   * Text sẽ được gửi thẳng lên server, server interpolate placeholder rồi gọi Gemini.
   */
  generateSceneFromText: (params: GenerateSceneFromTextParams) => Promise<ScriptData | undefined>;

  /**
   * Gọi API tạo ảnh từ imageGenPrompt.
   * Lưu kết quả base64 vào IndexedDB theo sceneId.
   */
  generateImage: (params: GenerateImageParams) => Promise<GeneratedImageData | undefined>;

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

  /**
   * Gọi API generate style description text từ images.
   */
  generateStyleText: (images: string[], prompt?: string) => Promise<string>;

  /**
   * Lấy danh sách ObjectToPersonify đang active từ GraphQL.
   * Trả về danh sách KHÔNG có prompt (dành cho customer).
   */
  getActiveObjectToPersonifyList: () => Promise<ObjectToPersonifyPublic[]>;

  /**
   * Lấy danh sách nhân vật tùy chỉnh của customer hiện tại.
   */
  getCustomerObjectToPersonifyList: () => Promise<ObjectToPersonifyPublic[]>;

  /**
   * Customer tạo nhân vật tùy chỉnh mới.
   */
  createCustomerObjectToPersonify: (data: {
    name: string;
    prompt?: string;
    imageUrl?: string;
  }) => Promise<ObjectToPersonifyPublic | undefined>;

  /**
   * Customer xoá nhân vật tùy chỉnh của mình.
   */
  deleteCustomerObjectToPersonify: (id: string) => Promise<boolean>;

  /**
   * Lấy danh sách TrendingCategory đang active.
   */
  getActiveTrendingCategoryList: () => Promise<TrendingCategoryPublicItem[]>;

  /**
   * Lấy danh sách trending items theo category ID, có phân trang.
   */
  getTrendingsByCategoryId: (
    categoryId?: string,
    page?: number,
    limit?: number,
    search?: string
  ) => Promise<TrendingsByCategoryResult>;

  /**
   * Lấy prompt của trending theo ID.
   */
  getTrendingPromptById: (trendingId: string) => Promise<string | null>;

  /**
   * Lấy danh sách trending do customer hiện tại tạo, có phân trang.
   */
  getCustomerTrendingList: (
    page?: number,
    limit?: number,
    search?: string
  ) => Promise<TrendingsByCategoryResult>;

  /**
   * Customer tạo trending mới.
   */
  createCustomerTrending: (data: CustomerTrendingInput) => Promise<any | undefined>;

  /**
   * Customer sửa trending của mình.
   */
  updateCustomerTrending: (
    id: string,
    data: Partial<CustomerTrendingInput>
  ) => Promise<any | undefined>;

  /**
   * Customer xoá trending của mình.
   */
  deleteCustomerTrending: (id: string) => Promise<boolean>;

  /**
   * Lấy bảng xếp hạng trending theo monthlyCount (giảm dần).
   */
  getTrendingRank: (
    page?: number,
    limit?: number,
    search?: string
  ) => Promise<TrendingsByCategoryResult>;

  generateTrendingSingle: (
    data: TrendingVideoFormConfig
  ) => Promise<TrendingScriptData | undefined>;

  getTrendingSceneHistory: () => Promise<TrendingHistoryItem[]>;
  clearTrendingHistory: () => Promise<void>;
  generateTrendingScene: (data: TrendingVideoFormConfig) => Promise<TrendingScriptData | undefined>;

  // ── Art Style APIs ──

  /**
   * Lấy danh sách ArtStyleCategory đang active.
   */
  getActiveArtStyleCategoryList: () => Promise<ArtStyleCategoryPublicItem[]>;

  /**
   * Lấy danh sách art style items theo category ID, có phân trang.
   */
  getArtStylesByCategoryId: (
    categoryId?: string,
    page?: number,
    limit?: number,
    search?: string
  ) => Promise<ArtStylesByCategoryResult>;

  /**
   * Lấy prompt của art style theo ID.
   */
  getArtStylePromptById: (artStyleId: string) => Promise<string | null>;

  /**
   * Lấy danh sách art style do customer hiện tại tạo, có phân trang.
   */
  getCustomerArtStyleList: (
    page?: number,
    limit?: number,
    search?: string
  ) => Promise<ArtStylesByCategoryResult>;

  /**
   * Customer tạo art style mới.
   */
  createCustomerArtStyle: (data: CustomerArtStyleInput) => Promise<any | undefined>;

  /**
   * Customer sửa art style của mình.
   */
  updateCustomerArtStyle: (
    id: string,
    data: Partial<CustomerArtStyleInput>
  ) => Promise<any | undefined>;

  /**
   * Customer xoá art style của mình.
   */
  deleteCustomerArtStyle: (id: string) => Promise<boolean>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAffiliateVideoApi(): UseAffiliateVideoApiReturn {
  const toast = useToast();
  const { STORY_MODE_OPTIONS, TRENDING_MODE_OPTIONS } = useOptionsTranslation();
  const scriptDB = useIndexedDB<any>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const imageDB = useIndexedDB<GeneratedImageData>(IMAGE_STORE_NAME, DB_NAME.generateImage);
  const videoDB = useIndexedDB<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);
  const audioDB = useIndexedDB<GeneratedAudioData>(AUDIO_STORE_NAME, DB_NAME.generateVoice);
  const copyVideoScriptDB = useIndexedDB<any>(COPY_VIDEO_STORE_NAME, DB_NAME.copyVideo);
  const { customer } = useAuth();
  // ── Shared: gọi API /api/app/generation-scene/ ──
  const callGenerationSceneApi = useCallback(
    async (body: {
      config: Partial<AffiliateVideoFormConfig>;
      text?: string;
      objectToPersonifyCode?: string;
      artStyleId?: string;
      productImages?: string[];
      /** Payload API – mảng ảnh tham chiếu nhân hoá (0–1 phần tử) */
      objectToPersonifyImages?: ElementFormImage[];
    }) => {
      const res = await fetch("/api/app/generation-scene/", {
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
  const callGenerationTrendingApi = useCallback(
    async (body: {
      config: Partial<TrendingVideoFormConfig>;
      promptId?: string;
      artStyleId?: string;
      productImages?: string[];
    }) => {
      const res = await fetch("/api/app/generation-trending/", {
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

  // ── Helper: push a ScriptData into history array in IndexedDB ──
  const pushToSceneHistory = useCallback(
    async (scriptResult: ScriptData) => {
      try {
        const existing: SceneHistoryItem[] = (await scriptDB.get(CACHE_KEY.sceneHistory)) || [];

        const now = new Date();
        const label = `${
          STORY_MODE_OPTIONS.find((s) => s.value === scriptResult.storyModeType)?.label
        } – ${now.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        })} ${now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const newItem: SceneHistoryItem = {
          id: crypto.randomUUID(),
          createdAt: now.getTime(),
          label,
          data: scriptResult,
        };

        // Prepend newest first, trim to MAX_SCENE_HISTORY
        const updated = [newItem, ...existing].slice(0, MAX_SCENE_HISTORY);
        await scriptDB.set(CACHE_KEY.sceneHistory, updated);
      } catch (e) {
        console.warn("[affiliate-video-api] Failed to push scene history", e);
      }
    },
    [scriptDB]
  );

  // ── Helper: push a ScriptData into history array in IndexedDB ──
  const pushToTrendingHistory = useCallback(
    async (scriptResult: TrendingScriptData) => {
      try {
        const existing: SceneHistoryItem[] = (await scriptDB.get(CACHE_KEY.trendingHistory)) || [];

        const now = new Date();
        const label = `${
          TRENDING_MODE_OPTIONS.find((s) => s.value === scriptResult.trendingModeType)?.label
        } – ${now.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
        })} ${now.toLocaleTimeString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
        })}`;

        const newItem: TrendingHistoryItem = {
          id: crypto.randomUUID(),
          createdAt: now.getTime(),
          label,
          data: scriptResult,
        };

        // Prepend newest first, trim to MAX_SCENE_HISTORY
        const updated = [newItem, ...existing].slice(0, MAX_SCENE_HISTORY);
        await scriptDB.set(CACHE_KEY.trendingHistory, updated);
      } catch (e) {
        console.warn("[affiliate-video-api] Failed to push scene history", e);
      }
    },
    [scriptDB]
  );

  // ── generateScene (flow cũ – từ config form) ──
  const generateScene = useCallback(
    async (data: AffiliateVideoFormConfig): Promise<ScriptData | undefined> => {
      const personifyApi = buildObjectToPersonifyApiFields(data);
      const configForApi =
        getObjectToPersonifyMode(data) === "image"
          ? stripObjectToPersonifyPromptFromConfig(data)
          : data;

      const result = await callGenerationSceneApi({
        config: configForApi,
        artStyleId: data.artStyleId || undefined,
        productImages: data.productImages,
        ...personifyApi,
      });
      if (!result) return undefined;
      const scriptResult: ScriptData = {
        ...result.data,
        storyModeType: data.storyModeType,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
        objectToPersonifyImage:
          getObjectToPersonifyMode(data) === "image" ? data.objectToPersonifyImage : undefined,
      };

      // Gán id ngẫu nhiên cho từng scene mới
      if (scriptResult?.scenes) {
        scriptResult.scenes = scriptResult.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
        }));
      }

      // Persist config input
      scriptDB
        .set(CACHE_KEY.generateInput, data)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      // Persist script result (include storyModeType)
      scriptDB
        .set(CACHE_KEY.lastScript, scriptResult)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));
      // Push to history (await so provider can read it immediately)
      await pushToSceneHistory(scriptResult);

      return scriptResult;
    },
    [callGenerationSceneApi, scriptDB, pushToSceneHistory]
  );

  const generateTrendingScene = useCallback(
    async (data: TrendingVideoFormConfig): Promise<TrendingScriptData | undefined> => {
      const result = await callGenerationTrendingApi({
        config: data,
        promptId: data.promptId,
        artStyleId: data.artStyleId || undefined,
        productImages: data.productImages,
      });
      if (!result) return undefined;
      const scriptResult: TrendingScriptData = {
        ...result.data,
        trendingModeType: data.trendingModeType,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
      };

      // Gán id ngẫu nhiên cho từng scene mới
      if (scriptResult?.scenes) {
        scriptResult.scenes = scriptResult.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
        }));
      }

      // Persist config input
      scriptDB
        .set(CACHE_KEY.trendingInput, data)
        .catch((e) => console.warn("[generateTrendingScene] IndexedDB write error", e));

      // Persist script result (include storyModeType)
      scriptDB
        .set(CACHE_KEY.lastTrendingScript, scriptResult)
        .catch((e) => console.warn("[generateTrendingScene] IndexedDB write error", e));
      // Push to history (await so provider can read it immediately)
      await pushToTrendingHistory(scriptResult);

      return scriptResult;
    },
    [callGenerationSceneApi, scriptDB, pushToTrendingHistory]
  );

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
      objectToPersonifyImages?: ElementFormImage[];
      objectToPersonify?: string;
      objectToPersonifyCode?: string;
      artStyleId?: string;
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

      const personifyApi = buildObjectToPersonifyApiFields(data);

      const result = await callCopyVideoAnalysisApi({
        videoBase64: data.sourceVideo.base64,
        mimeType: data.sourceVideo.mimeType,
        artStyle: data.artStyle,
        language: data.language,
        mood: data.mood,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
        artStyleId: data.artStyleId || undefined,
        ...personifyApi,
      });
      if (!result) return undefined;

      const analysisResult: CopyVideoAnalysisData = {
        ...result.data,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
        objectToPersonifyImage:
          getObjectToPersonifyMode(data) === "image" ? data.objectToPersonifyImage : undefined,
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

  // ── generateSceneFromText (flow mới – gửi text trực tiếp) ──
  const generateSceneFromText = useCallback(
    async (params: GenerateSceneFromTextParams): Promise<ScriptData | undefined> => {
      const { text, config = {} } = params;

      const result = await callGenerationSceneApi({
        config,
        text,
        objectToPersonifyCode: config.objectToPersonify?.trim()
          ? config.objectToPersonifyCode
          : undefined,
        artStyleId: config.artStyleId || undefined,
        productImages: config.productImages,
      });
      if (!result) return undefined;
      const scriptResult: ScriptData = { ...result.data, productImages: config.productImages };

      // Gán id ngẫu nhiên cho từng scene mới
      if (scriptResult?.scenes) {
        scriptResult.scenes = scriptResult.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
        }));
      }

      // Persist script result (include storyModeType)
      scriptDB
        .set(CACHE_KEY.lastScript, {
          ...scriptResult,
          storyModeType: config.storyModeType,
          productImages: config.productImages,
        })
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      // Push to history (await so provider can read it immediately)
      await pushToSceneHistory(scriptResult);

      return scriptResult;
    },
    [callGenerationSceneApi, scriptDB, pushToSceneHistory]
  );

  // ── generateSceneFromText (flow mới – gửi text trực tiếp) ──
  const generateTrendingSingle = useCallback(
    async (data: TrendingVideoFormConfig): Promise<TrendingScriptData | undefined> => {
      const result = await callGenerationTrendingApi({
        config: data,
        promptId: data.promptId,
        artStyleId: data.artStyleId || undefined,
        productImages: data.productImages,
      });
      if (!result) return undefined;
      const scriptResult: TrendingScriptData = {
        ...result.data,
        trendingModeType: data.trendingModeType,
        aspectRatio: data.aspectRatio,
        productImages: data.productImages,
      };

      // Gán id ngẫu nhiên cho từng scene mới
      if (scriptResult?.scenes) {
        scriptResult.scenes = scriptResult.scenes.map((scene) => ({
          ...scene,
          id: crypto.randomUUID(),
        }));
      }

      // Persist script result (include trendingModeType + aspectRatio from form)
      scriptDB
        .set(CACHE_KEY.lastTrendingScript, scriptResult)
        .catch((e) => console.warn("[trending -api] IndexedDB write error", e));

      // Push to history (await so provider can read it immediately)
      await pushToTrendingHistory(scriptResult);

      return scriptResult;
    },
    [callGenerationTrendingApi, scriptDB, pushToTrendingHistory]
  );

  // ── generateImage – gọi API tạo ảnh từ prompt ──
  const generateImage = useCallback(
    async (params: GenerateImageParams): Promise<GeneratedImageData | undefined> => {
      const {
        sceneId,
        prompt,
        aspectRatio,
        referenceImage,
        additionalImages,
        productImages,
        objectToPersonifyImage,
        productImagePrompt,
        noText,
        onProgress,
        onError,
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

        const personifyApiImages = hasObjectToPersonifyImage(objectToPersonifyImage)
          ? await objectToPersonifyImageToApiImages(objectToPersonifyImage)
          : [];

        const res = await fetch("/api/app/generation-image/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            images: images.length > 0 ? images : undefined,
            productImages: productImages?.length ? productImages : undefined,
            objectToPersonifyImages: personifyApiImages.length ? personifyApiImages : undefined,
            productImagePrompt: productImagePrompt || undefined,
            config: { numberOfImages: 1, aspectRatio, noText },
          }),
        });

        const result = await consumeGenerationResponse(res, {
          onProgress: (pct) => {
            clearInterval(progressTimer);
            onProgress?.(pct);
          },
          onError,
        });

        const resultImages = extractGeneratedImages(result) as GeneratedImageData[];

        if (resultImages.length === 0) {
          clearInterval(progressTimer);
          const message = "Không nhận được ảnh từ API";
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        const imageData = resultImages[0];

        await imageDB.set(sceneId, imageData);

        clearInterval(progressTimer);
        onProgress?.(100);

        return imageData;
      } catch (err: any) {
        clearInterval(progressTimer);
        onProgress?.(0);
        const message = err?.message || "Lỗi tạo ảnh";
        if (onError) onError(message);
        else console.error(message);
        console.error("[generateImage] Error:", err);
        return undefined;
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
        aspectRatio,
        generateAudio,
        onProgress,
        onStatusMessage,
        onError,
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
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        // Read SSE stream
        const reader = res.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          const message = "Không thể đọc response stream";
          if (onError) onError(message);
          else console.error(message);
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
                const message = event.message || "Lỗi tạo video";
                if (onError) onError(message);
                else console.error(message);
                return undefined;
              }
            } catch (parseErr) {
              // Ignore malformed SSE lines
            }
          }
        }

        if (!videoData) {
          const message = "Không nhận được video từ API";
          if (onError) onError(message);
          else console.error(message);
          return undefined;
        }

        // Attach the aspect ratio used at generation time
        videoData.aspectRatio = aspectRatio;
        // Persist to IndexedDB
        await videoDB.set(sceneId, videoData);

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

  // ── getSceneHistory – lấy lịch sử generate scene ──
  const getTrendingSceneHistory = useCallback(async (): Promise<TrendingHistoryItem[]> => {
    if (!customer?._id) return [];
    try {
      return (await scriptDB.get(CACHE_KEY.trendingHistory)) || [];
    } catch {
      return [];
    }
  }, [scriptDB, customer?._id]);

  // ── clearSceneHistory – xóa toàn bộ lịch sử ──
  const clearSceneHistory = useCallback(async (): Promise<void> => {
    if (!customer?._id) return;
    await scriptDB.set(CACHE_KEY.sceneHistory, []);
  }, [scriptDB, customer?._id]);

  // ── clearSceneHistory – xóa toàn bộ lịch sử ──
  const clearTrendingHistory = useCallback(async (): Promise<void> => {
    if (!customer?._id) return;
    await scriptDB.set(CACHE_KEY.trendingHistory, []);
  }, [scriptDB, customer?._id]);

  // ── generateStyleText – gọi API tạo mô tả phong cách từ AI ──
  const generateStyleText = useCallback(
    async (images: string[], prompt?: string): Promise<string> => {
      const res = await fetch("/api/app/generate-style-text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, prompt }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err?.message || `Lỗi ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }

      const result = await res.json();
      return result?.data?.text || result?.text || result?.data?.result || result?.result || "";
    },
    [toast]
  );

  // ── getActiveObjectToPersonifyList – lấy danh sách nhân vật nhân hoá active từ GraphQL ──
  const getActiveObjectToPersonifyList = useCallback(async (): Promise<
    ObjectToPersonifyPublic[]
  > => {
    try {
      const res = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query { getActiveObjectToPersonifyList { id name imageUrl code isActive } }`,
        }),
      });

      if (!res.ok) {
        console.error("[getActiveObjectToPersonifyList] HTTP error:", res.status);
        return [];
      }

      const json = await res.json();
      if (json.errors?.length) {
        console.error("[getActiveObjectToPersonifyList] GraphQL errors:", json.errors);
        return [];
      }

      return (json.data?.getActiveObjectToPersonifyList || []) as ObjectToPersonifyPublic[];
    } catch (err: any) {
      console.error("[getActiveObjectToPersonifyList] Error:", err);
      return [];
    }
  }, []);

  // ── getCustomerObjectToPersonifyList – lấy danh sách nhân vật tùy chỉnh của customer ──
  const getCustomerObjectToPersonifyList = useCallback(async (): Promise<
    ObjectToPersonifyPublic[]
  > => {
    try {
      const res = await fetch("/graphql", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: `query { getCustomerObjectToPersonifyList { id name imageUrl code isActive } }`,
        }),
      });

      if (!res.ok) {
        console.error("[getCustomerObjectToPersonifyList] HTTP error:", res.status);
        return [];
      }

      const json = await res.json();
      if (json.errors?.length) {
        console.error("[getCustomerObjectToPersonifyList] GraphQL errors:", json.errors);
        return [];
      }

      return (json.data?.getCustomerObjectToPersonifyList || []) as ObjectToPersonifyPublic[];
    } catch (err: any) {
      console.error("[getCustomerObjectToPersonifyList] Error:", err);
      return [];
    }
  }, []);

  // ── createCustomerObjectToPersonify – customer tạo nhân vật tùy chỉnh ──
  const createCustomerObjectToPersonify = useCallback(
    async (data: {
      name: string;
      prompt?: string;
      imageUrl?: string;
    }): Promise<ObjectToPersonifyPublic | undefined> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation CreateCustomerObject($data: CreateCustomerObjectToPersonifyInput!) {
              createCustomerObjectToPersonify(data: $data) { id name imageUrl code isActive }
            }`,
            variables: { data },
          }),
        });

        if (!res.ok) {
          console.error("[createCustomerObjectToPersonify] HTTP error:", res.status);
          return undefined;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[createCustomerObjectToPersonify] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi tạo nhân vật");
          return undefined;
        }

        return json.data?.createCustomerObjectToPersonify as ObjectToPersonifyPublic;
      } catch (err: any) {
        console.error("[createCustomerObjectToPersonify] Error:", err);
        return undefined;
      }
    },
    [toast]
  );

  // ── deleteCustomerObjectToPersonify – customer xoá nhân vật tùy chỉnh ──
  const deleteCustomerObjectToPersonify = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation DeleteCustomerObject($id: ID!) {
              deleteCustomerObjectToPersonify(id: $id) { id name }
            }`,
            variables: { id },
          }),
        });

        if (!res.ok) {
          console.error("[deleteCustomerObjectToPersonify] HTTP error:", res.status);
          return false;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[deleteCustomerObjectToPersonify] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi xoá nhân vật");
          return false;
        }

        return true;
      } catch (err: any) {
        console.error("[deleteCustomerObjectToPersonify] Error:", err);
        return false;
      }
    },
    [toast]
  );

  // ── getActiveTrendingCategoryList – lấy danh sách trending category active ──
  const getActiveTrendingCategoryList = useCallback(async () => {
    return TrendingCategoryService.getActiveTrendingCategoryList();
  }, []);

  // ── getTrendingsByCategoryId – lấy trending items theo category ID, phân trang ──
  const getTrendingsByCategoryId = useCallback(
    async (categoryId?: string, page: number = 1, limit: number = 10, search?: string) => {
      return TrendingCategoryService.getTrendingsByCategoryId(categoryId, page, limit, search);
    },
    []
  );

  // ── getTrendingPromptById – lấy prompt của trending theo ID ──
  const getTrendingPromptById = useCallback(async (trendingId: string): Promise<string | null> => {
    return TrendingCategoryService.getTrendingPromptById(trendingId);
  }, []);

  // ── getCustomerTrendingList – lấy danh sách trending của customer ──
  const getCustomerTrendingList = useCallback(
    async (page: number = 1, limit: number = 10, search?: string) => {
      return TrendingCategoryService.getCustomerTrendingList(page, limit, search);
    },
    []
  );

  // ── getTrendingRank – bảng xếp hạng trending theo monthlyCount ──
  const getTrendingRank = useCallback(
    async (page: number = 1, limit: number = 20, search?: string) => {
      return TrendingCategoryService.getTrendingRank(page, limit, search);
    },
    []
  );

  // ── createCustomerTrending – customer tạo trending mới ──
  const createCustomerTrending = useCallback(
    async (data: CustomerTrendingInput): Promise<any | undefined> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation CreateCustomerTrending($data: CreateCustomerTrendingInput!) {
              createCustomerTrending(data: $data) { id name imageUrls prompt des isPublish price count promptShort trendingCategoryIds }
            }`,
            variables: { data },
          }),
        });

        if (!res.ok) {
          console.error("[createCustomerTrending] HTTP error:", res.status);
          return undefined;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[createCustomerTrending] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi tạo trending");
          return undefined;
        }

        return json.data?.createCustomerTrending;
      } catch (err: any) {
        console.error("[createCustomerTrending] Error:", err);
        return undefined;
      }
    },
    [toast]
  );

  // ── updateCustomerTrending – customer sửa trending của mình ──
  const updateCustomerTrending = useCallback(
    async (id: string, data: Partial<CustomerTrendingInput>): Promise<any | undefined> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation UpdateCustomerTrending($id: ID!, $data: UpdateCustomerTrendingInput!) {
              updateCustomerTrending(id: $id, data: $data) { id name imageUrls prompt des isPublish price count promptShort trendingCategoryIds }
            }`,
            variables: { id, data },
          }),
        });

        if (!res.ok) {
          console.error("[updateCustomerTrending] HTTP error:", res.status);
          return undefined;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[updateCustomerTrending] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi sửa trending");
          return undefined;
        }

        return json.data?.updateCustomerTrending;
      } catch (err: any) {
        console.error("[updateCustomerTrending] Error:", err);
        return undefined;
      }
    },
    [toast]
  );

  // ── deleteCustomerTrending – customer xoá trending của mình ──
  const deleteCustomerTrending = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation DeleteCustomerTrending($id: ID!) {
              deleteCustomerTrending(id: $id) { id name }
            }`,
            variables: { id },
          }),
        });

        if (!res.ok) {
          console.error("[deleteCustomerTrending] HTTP error:", res.status);
          return false;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[deleteCustomerTrending] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi xoá trending");
          return false;
        }

        return true;
      } catch (err: any) {
        console.error("[deleteCustomerTrending] Error:", err);
        return false;
      }
    },
    [toast]
  );

  // ── Art Style APIs ──────────────────────────────────────────────────────

  // ── getActiveArtStyleCategoryList – lấy danh sách art style category active ──
  const getActiveArtStyleCategoryList = useCallback(async () => {
    return ArtStyleCategoryService.getActiveArtStyleCategoryList();
  }, []);

  // ── getArtStylesByCategoryId – lấy art style items theo category ID, phân trang ──
  const getArtStylesByCategoryId = useCallback(
    async (categoryId?: string, page: number = 1, limit: number = 10, search?: string) => {
      return ArtStyleCategoryService.getArtStylesByCategoryId(categoryId, page, limit, search);
    },
    []
  );

  // ── getArtStylePromptById – lấy prompt của art style theo ID ──
  const getArtStylePromptById = useCallback(async (artStyleId: string): Promise<string | null> => {
    return ArtStyleCategoryService.getArtStylePromptById(artStyleId);
  }, []);

  // ── getCustomerArtStyleList – lấy danh sách art style của customer ──
  const getCustomerArtStyleList = useCallback(
    async (page: number = 1, limit: number = 10, search?: string) => {
      return ArtStyleCategoryService.getCustomerArtStyleList(page, limit, search);
    },
    []
  );

  // ── createCustomerArtStyle – customer tạo art style mới ──
  const createCustomerArtStyle = useCallback(
    async (data: CustomerArtStyleInput): Promise<any | undefined> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation CreateCustomerArtStyle($data: CreateCustomerArtStyleInput!) {
              createCustomerArtStyle(data: $data) { id name imageUrls prompt des isPublish price count promptShort artStyleCategoryIds }
            }`,
            variables: { data },
          }),
        });

        if (!res.ok) {
          console.error("[createCustomerArtStyle] HTTP error:", res.status);
          return undefined;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[createCustomerArtStyle] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi tạo art style");
          return undefined;
        }

        return json.data?.createCustomerArtStyle;
      } catch (err: any) {
        console.error("[createCustomerArtStyle] Error:", err);
        return undefined;
      }
    },
    [toast]
  );

  // ── updateCustomerArtStyle – customer sửa art style của mình ──
  const updateCustomerArtStyle = useCallback(
    async (id: string, data: Partial<CustomerArtStyleInput>): Promise<any | undefined> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation UpdateCustomerArtStyle($id: ID!, $data: UpdateCustomerArtStyleInput!) {
              updateCustomerArtStyle(id: $id, data: $data) { id name imageUrls prompt des isPublish price count promptShort artStyleCategoryIds }
            }`,
            variables: { id, data },
          }),
        });

        if (!res.ok) {
          console.error("[updateCustomerArtStyle] HTTP error:", res.status);
          return undefined;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[updateCustomerArtStyle] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi sửa art style");
          return undefined;
        }

        return json.data?.updateCustomerArtStyle;
      } catch (err: any) {
        console.error("[updateCustomerArtStyle] Error:", err);
        return undefined;
      }
    },
    [toast]
  );

  // ── deleteCustomerArtStyle – customer xoá art style của mình ──
  const deleteCustomerArtStyle = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch("/graphql", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `mutation DeleteCustomerArtStyle($id: ID!) {
              deleteCustomerArtStyle(id: $id) { id name }
            }`,
            variables: { id },
          }),
        });

        if (!res.ok) {
          console.error("[deleteCustomerArtStyle] HTTP error:", res.status);
          return false;
        }

        const json = await res.json();
        if (json.errors?.length) {
          console.error("[deleteCustomerArtStyle] GraphQL errors:", json.errors);
          toast.error(json.errors[0]?.message || "Lỗi xoá art style");
          return false;
        }

        return true;
      } catch (err: any) {
        console.error("[deleteCustomerArtStyle] Error:", err);
        return false;
      }
    },
    [toast]
  );

  return {
    generateScene,
    generateSceneFromText,
    generateImage,
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
    generateStyleText,
    getActiveObjectToPersonifyList,
    getCustomerObjectToPersonifyList,
    createCustomerObjectToPersonify,
    deleteCustomerObjectToPersonify,
    getActiveTrendingCategoryList,
    getTrendingsByCategoryId,
    getTrendingPromptById,
    getCustomerTrendingList,
    createCustomerTrending,
    updateCustomerTrending,
    deleteCustomerTrending,
    getTrendingRank,
    generateTrendingSingle,
    generateTrendingScene,
    getTrendingSceneHistory,
    clearTrendingHistory,
    getActiveArtStyleCategoryList,
    getArtStylesByCategoryId,
    getArtStylePromptById,
    getCustomerArtStyleList,
    createCustomerArtStyle,
    updateCustomerArtStyle,
    deleteCustomerArtStyle,
  };
}
