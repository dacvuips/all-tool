/**
 * useSceneProgressBroadcast.ts
 * Broadcast tiến độ tạo media (0–100) từ poll job cho từng scene card.
 *
 * Batch actions gọi reportSceneProgress(sceneId, kind, pct) qua onProgress của API.
 * useSceneMedia (và các biến thể) subscribe để hiển thị progress khi batch chạy nền.
 *
 * Quy ước sceneId:
 * - "{sceneId}"          → kind: "image" | "video"
 * - "{sceneId}::stitch"  → kind: "extend" (video nối)
 */
import { useCallback, useRef } from "react";

export type SceneProgressKind = "image" | "video" | "extend";

export interface SceneProgress {
  image?: number;
  video?: number;
  extend?: number;
}

export interface SceneProgressBroadcast {
  reportSceneProgress: (
    sceneId: string,
    kind: SceneProgressKind,
    progress: number | null
  ) => void;
  subscribeSceneProgress: (
    sceneId: string,
    callback: (progress: SceneProgress) => void
  ) => () => void;
}

export function useSceneProgressBroadcast(): SceneProgressBroadcast {
  const sceneProgressRef = useRef<Map<string, SceneProgress>>(new Map());
  const subscribersRef = useRef<Map<string, (progress: SceneProgress) => void>>(new Map());

  const reportSceneProgress = useCallback(
    (sceneId: string, kind: SceneProgressKind, progress: number | null) => {
      const isStitch = sceneId.endsWith("::stitch");
      const baseId = isStitch ? sceneId.replace(/::stitch$/, "") : sceneId;
      const effectiveKind: SceneProgressKind = isStitch ? "extend" : kind;

      const existing = sceneProgressRef.current.get(baseId) || {};
      const next: SceneProgress = { ...existing };

      if (progress === null) {
        delete next[effectiveKind];
      } else {
        const prev = next[effectiveKind] ?? -1;
        next[effectiveKind] = Math.max(prev, progress);
      }

      sceneProgressRef.current.set(baseId, next);

      const cb = subscribersRef.current.get(baseId);
      if (cb) cb({ ...next });
    },
    []
  );

  const subscribeSceneProgress = useCallback(
    (sceneId: string, callback: (progress: SceneProgress) => void) => {
      subscribersRef.current.set(sceneId, callback);
      const current = sceneProgressRef.current.get(sceneId) || {};
      callback({ ...current });
      return () => {
        subscribersRef.current.delete(sceneId);
      };
    },
    []
  );

  return { reportSceneProgress, subscribeSceneProgress };
}
