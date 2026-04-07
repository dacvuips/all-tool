/**
 * useAffiliateVideoApi.ts
 * Hook chứa tất cả các hàm gọi API cho module affiliate-video.
 */
import { useCallback } from "react";
import { useToast } from "../../../../lib/providers/toast-provider";
import { AffiliateVideoFormConfig, CACHE_KEY, DB_NAME, ScriptData, STORE_NAME } from "../constants";
import { useIndexedDB } from "./useIndexedDB";

// ── Image generation store name ────────────────────────────────────────────
const IMAGE_STORE_NAME = "generated-images";
const VIDEO_STORE_NAME = "generated-videos";

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
  /** Callback nhận progress 0-100 */
  onProgress?: (pct: number) => void;
}

export interface GenerateVideoParams {
  /** Scene ID – dùng làm key lưu vào IndexedDB */
  sceneId: string;
  /** Video generation prompt (scene.motionPrompt hoặc scene.imageGenPrompt) */
  prompt: string;
  /** Optional generated image to use for image-to-video */
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

export interface GeneratedImageData {
  imageBytes: string; // base64
  mimeType: string;
}

export interface GeneratedVideoData {
  videoUri: string | null;
  videoBytes: string | null; // base64 – returned when no outputGcsUri is set
  mimeType: string;
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
   * Gọi API tạo video từ prompt (Veo 3.1 fast).
   * Sử dụng SSE để nhận progress từ server.
   * Lưu kết quả vào IndexedDB theo sceneId.
   */
  generateVideo: (params: GenerateVideoParams) => Promise<GeneratedVideoData | undefined>;

  /**
   * Lấy video đã tạo từ IndexedDB theo sceneId.
   */
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoData | undefined>;
}

// ── Hook ───────────────────────────────────────────────────────────────────

export function useAffiliateVideoApi(): UseAffiliateVideoApiReturn {
  const toast = useToast();
  const scriptDB = useIndexedDB<any>(STORE_NAME.generateScene, DB_NAME.generateScene);
  const imageDB = useIndexedDB<GeneratedImageData>(IMAGE_STORE_NAME, DB_NAME.generateImage);
  const videoDB = useIndexedDB<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);

  // ── Shared: gọi API /api/app/generation-scene/ ──
  const callGenerationSceneApi = useCallback(
    async (body: { config: Partial<AffiliateVideoFormConfig>; text?: string }) => {
      const res = await fetch("/api/app/generation-scene/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const message = err?.message || `Lỗi ${res.status}`;
        toast.error(message);
        throw new Error(message);
      }

      return res.json();
    },
    [toast]
  );

  // ── generateScene (flow cũ – từ config form) ──
  const generateScene = useCallback(
    async (data: AffiliateVideoFormConfig): Promise<ScriptData | undefined> => {
      const result = await callGenerationSceneApi({ config: data });
      const scriptResult: ScriptData = result.data;

      // Persist config input
      scriptDB
        .set(CACHE_KEY.generateInput, data)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      // Persist script result
      scriptDB
        .set(CACHE_KEY.lastScript, scriptResult)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      return scriptResult;
    },
    [callGenerationSceneApi, scriptDB]
  );

  // ── generateSceneFromText (flow mới – gửi text trực tiếp) ──
  const generateSceneFromText = useCallback(
    async (params: GenerateSceneFromTextParams): Promise<ScriptData | undefined> => {
      const { text, config = {} } = params;

      const result = await callGenerationSceneApi({
        config,
        text,
      });
      const scriptResult: ScriptData = result.data;

      // Persist script result
      scriptDB
        .set(CACHE_KEY.lastScript, scriptResult)
        .catch((e) => console.warn("[affiliate-video-api] IndexedDB write error", e));

      return scriptResult;
    },
    [callGenerationSceneApi, scriptDB]
  );

  // ── generateImage – gọi API tạo ảnh từ prompt ──
  const generateImage = useCallback(
    async (params: GenerateImageParams): Promise<GeneratedImageData | undefined> => {
      const { sceneId, prompt, aspectRatio = "9:16", onProgress } = params;

      try {
        // Simulate progress: 0% → 20% immediately (request sent)
        onProgress?.(10);

        const res = await fetch("/api/app/generation-image/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt,
            config: { numberOfImages: 1, aspectRatio },
          }),
        });

        onProgress?.(60);

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          throw new Error(message);
        }

        const result = await res.json();
        onProgress?.(80);

        // Handle both formats: direct array [...] or wrapped { data: [...] }
        const images: GeneratedImageData[] = Array.isArray(result)
          ? result
          : Array.isArray(result.data)
          ? result.data
          : [];

        if (images.length === 0) {
          toast.error("Không nhận được ảnh từ API");
          return undefined;
        }

        const imageData = images[0];

        // Persist to IndexedDB
        await imageDB.set(sceneId, imageData);
        onProgress?.(100);

        return imageData;
      } catch (err: any) {
        onProgress?.(0);
        console.error("[generateImage] Error:", err);
        throw err;
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

  // ── generateVideo – gọi API tạo video từ prompt (SSE) ──
  const generateVideo = useCallback(
    async (params: GenerateVideoParams): Promise<GeneratedVideoData | undefined> => {
      const {
        sceneId,
        prompt,
        image,
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
            image,
            config: { aspectRatio, generateAudio },
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          const message = err?.message || `Lỗi ${res.status}`;
          toast.error(message);
          throw new Error(message);
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

        // Persist to IndexedDB
        await videoDB.set(sceneId, videoData);

        return videoData;
      } catch (err: any) {
        onProgress?.(0);
        console.error("[generateVideo] Error:", err);
        throw err;
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

  return {
    generateScene,
    generateSceneFromText,
    generateImage,
    getGeneratedImage,
    generateVideo,
    getGeneratedVideo,
  };
}
