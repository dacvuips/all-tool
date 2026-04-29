/**
 * useVideoThumbnail.ts
 *
 * Custom hook to extract a thumbnail frame from a video at a given timestamp.
 * Uses an offscreen <video> + <canvas> to seek to the desired time and capture
 * the frame as a data URL.
 *
 * @param videoBase64 - Raw base64 string of the source video (no data-URI prefix)
 * @param mimeType    - e.g. "video/mp4"
 * @param timestamp   - Scene timestamp string, e.g. "00:00 - 00:01" or "01:23 - 01:30"
 *                      The hook seeks to the START time of the range.
 */
import { useEffect, useRef, useState } from "react";

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
