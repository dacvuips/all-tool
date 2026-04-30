/**
 * useVideoThumbnail.ts
 *
 * Custom hook to extract a thumbnail frame from a video at a given timestamp.
 * Uses an offscreen <video> + <canvas> to seek to the desired time and capture
 * the frame as a data URL.
 *
 * Also exports:
 * - extractAndSaveThumbnails(): standalone function to batch-extract thumbnails
 *   from a video for all scenes and persist them to IndexedDB.
 * - useSceneThumbnail(): hook to load a pre-saved thumbnail from IndexedDB by scene ID.
 *
 * @param videoBase64 - Raw base64 string of the source video (no data-URI prefix)
 * @param mimeType    - e.g. "video/mp4"
 * @param timestamp   - Scene timestamp string, e.g. "00:00 - 00:01" or "01:23 - 01:30"
 *                      The hook seeks to the START time of the range.
 */
import { useEffect, useRef, useState } from "react";
import { CopyVideoScene, DB_NAME } from "../constants";
import { useIndexedDB } from "./useIndexedDB";

/** IndexedDB store name for persisted scene thumbnails */
const THUMBNAIL_STORE_NAME = "scene-thumbnails";

/** Key prefix used in IndexedDB for scene thumbnails */
export const THUMBNAIL_KEY_PREFIX = "thumbnail::";

/** Parse "MM:SS" → seconds */
function parseTimestamp(ts: string): number {
  // Support "MM:SS" or "HH:MM:SS"
  const parts = ts.trim().split(":").map(Number);
  if (parts.length === 3) {
    return (parts[0] || 0) * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);
  }
  if (parts.length === 2) {
    return (parts[0] || 0) * 60 + (parts[1] || 0);
  }
  return 0;
}

/** Extract the start time from a timestamp range like "00:05 - 00:10" */
function getStartTimeFromRange(timestampRange: string): number {
  if (!timestampRange) return 0;
  // Split by " - " or "-" to get start part
  const parts = timestampRange.split(/\s*-\s*/);
  return parseTimestamp(parts[0] || "00:00");
}

export interface VideoThumbnailResult {
  /** The thumbnail as a data URL (e.g. "data:image/png;base64,...") */
  thumbnailUrl: string | null;
  /** Whether the thumbnail is currently being generated */
  loading: boolean;
  /** Error message if extraction failed */
  error: string | null;
}

export function useVideoThumbnail(
  videoBase64: string | undefined,
  mimeType: string | undefined,
  timestamp: string | undefined
): VideoThumbnailResult {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs to track the latest inputs and avoid stale closures
  const abortRef = useRef(false);

  useEffect(() => {
    // Reset state
    setThumbnailUrl(null);
    setError(null);

    if (!videoBase64 || !mimeType || !timestamp) {
      return;
    }

    abortRef.current = false;
    setLoading(true);

    const seekTime = getStartTimeFromRange(timestamp);
    const videoSrc = `data:${mimeType};base64,${videoBase64}`;

    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.playsInline = true;
    // Cross-origin not needed for data URIs
    video.crossOrigin = "anonymous";

    let cleaned = false;

    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
      video.removeEventListener("loadeddata", onLoadedData);
      video.pause();
      video.removeAttribute("src");
      video.load(); // release resources
    };

    const onError = () => {
      if (abortRef.current) return;
      setError("Failed to load video for thumbnail extraction");
      setLoading(false);
      cleanup();
    };

    const onSeeked = () => {
      if (abortRef.current) return;
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
          setThumbnailUrl(dataUrl);
        } else {
          setError("Canvas 2D context not available");
        }
      } catch (err) {
        setError("Failed to capture video frame");
        console.error("[useVideoThumbnail] capture error:", err);
      } finally {
        setLoading(false);
        cleanup();
      }
    };

    const onLoadedData = () => {
      if (abortRef.current) return;
      // Clamp seek time to video duration
      const safeTime = Math.min(seekTime, video.duration || 0);
      video.currentTime = safeTime;
    };

    video.addEventListener("loadeddata", onLoadedData);
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.src = videoSrc;

    return () => {
      abortRef.current = true;
      setLoading(false);
      cleanup();
    };
  }, [videoBase64, mimeType, timestamp]);

  return { thumbnailUrl, loading, error };
}

// ─────────────────────────────────────────────────────────────────────────────
// extractAndSaveThumbnails
// Standalone async function: load video once, seek to each scene's timestamp,
// capture the frame, and persist the data URL to IndexedDB.
// Called once after video analysis completes – thumbnails are then immutable.
// ─────────────────────────────────────────────────────────────────────────────

/** Capture a single frame from a loaded <video> at `seekTime` seconds. */
function captureFrameAtTime(video: HTMLVideoElement, seekTime: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeTime = Math.min(seekTime, video.duration || 0);

    const onSeeked = () => {
      video.removeEventListener("seeked", onSeeked);
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth || 320;
        canvas.height = video.videoHeight || 180;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        } else {
          reject(new Error("Canvas 2D context not available"));
        }
      } catch (err) {
        reject(err);
      }
    };

    video.addEventListener("seeked", onSeeked);
    video.currentTime = safeTime;
  });
}

/**
 * Extract thumbnail frames from a video for every scene and persist them to IndexedDB.
 *
 * @param videoBase64 - Raw base64 string of the source video
 * @param mimeType    - e.g. "video/mp4"
 * @param scenes      - Array of CopyVideoScene (must have `id` and `timestamp`)
 * @param thumbnailDB - IndexedDB helper from `useIndexedDB`
 * @returns Promise<void>
 */
export async function extractAndSaveThumbnails(
  videoBase64: string,
  mimeType: string,
  scenes: CopyVideoScene[],
  thumbnailDB: { set: (key: IDBValidKey, value: any) => Promise<void> }
): Promise<void> {
  if (!videoBase64 || !mimeType || !scenes?.length) return;

  const videoSrc = `data:${mimeType};base64,${videoBase64}`;

  // Create a single offscreen video element and wait for it to load
  const video = document.createElement("video");
  video.preload = "auto";
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";

  await new Promise<void>((resolve, reject) => {
    video.addEventListener("loadeddata", () => resolve(), { once: true });
    video.addEventListener("error", () => reject(new Error("Failed to load video")), {
      once: true,
    });
    video.src = videoSrc;
  });

  // Seek to each scene's timestamp sequentially and capture frames
  for (const scene of scenes) {
    if (!scene.id || !scene.timestamp) continue;
    try {
      const seekTime = getStartTimeFromRange(scene.timestamp);
      const dataUrl = await captureFrameAtTime(video, seekTime);
      await thumbnailDB.set(`${THUMBNAIL_KEY_PREFIX}${scene.id}`, dataUrl);
    } catch (err) {
      console.warn(`[extractAndSaveThumbnails] Failed for scene ${scene.id}:`, err);
    }
  }

  // Cleanup video element
  video.pause();
  video.removeAttribute("src");
  video.load();
}

// ─────────────────────────────────────────────────────────────────────────────
// useSceneThumbnail
// Hook to load a persisted thumbnail from IndexedDB by scene ID.
// Returns { thumbnailUrl, loading }.
// ─────────────────────────────────────────────────────────────────────────────

export function useSceneThumbnail(sceneId: string | undefined): {
  thumbnailUrl: string | null;
  loading: boolean;
} {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const thumbnailDB = useIndexedDB<string>(THUMBNAIL_STORE_NAME, DB_NAME.copyVideo);

  useEffect(() => {
    if (!sceneId) {
      setThumbnailUrl(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    thumbnailDB
      .get(`${THUMBNAIL_KEY_PREFIX}${sceneId}`)
      .then((dataUrl) => {
        if (!cancelled) {
          setThumbnailUrl(dataUrl || null);
        }
      })
      .catch(() => {
        if (!cancelled) setThumbnailUrl(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sceneId]);

  return { thumbnailUrl, loading };
}

/**
 * Hook that returns the thumbnailDB helper for use in components/forms
 * that need to call extractAndSaveThumbnails.
 */
export function useThumbnailDB() {
  return useIndexedDB<string>(THUMBNAIL_STORE_NAME, DB_NAME.copyVideo);
}
