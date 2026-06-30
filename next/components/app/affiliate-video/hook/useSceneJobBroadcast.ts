/**
 * useSceneJobBroadcast.ts
 * Theo dõi jobId đang chạy cho từng scene (ảnh / video / video nối).
 * Batch và single generation đều gọi registerSceneJob khi enqueue.
 */
import { useCallback, useRef } from "react";
import type { SceneProgressKind } from "./useSceneProgressBroadcast";

export interface SceneJobs {
  image?: string;
  video?: string;
  extend?: string;
}

export interface SceneJobBroadcast {
  registerSceneJob: (sceneId: string, kind: SceneProgressKind, jobId: string | null) => void;
  getSceneJob: (sceneId: string, kind: SceneProgressKind) => string | undefined;
  subscribeSceneJobs: (sceneId: string, callback: (jobs: SceneJobs) => void) => () => void;
}

export function useSceneJobBroadcast(): SceneJobBroadcast {
  const sceneJobsRef = useRef<Map<string, SceneJobs>>(new Map());
  const subscribersRef = useRef<Map<string, (jobs: SceneJobs) => void>>(new Map());

  const registerSceneJob = useCallback(
    (sceneId: string, kind: SceneProgressKind, jobId: string | null) => {
      const isStitch = sceneId.endsWith("::stitch");
      const baseId = isStitch ? sceneId.replace(/::stitch$/, "") : sceneId;
      const effectiveKind: SceneProgressKind = isStitch ? "extend" : kind;

      const existing = sceneJobsRef.current.get(baseId) || {};
      const next: SceneJobs = { ...existing };

      if (jobId === null) {
        delete next[effectiveKind];
      } else {
        next[effectiveKind] = jobId;
      }

      sceneJobsRef.current.set(baseId, next);
      const cb = subscribersRef.current.get(baseId);
      if (cb) cb({ ...next });
    },
    []
  );

  const getSceneJob = useCallback((sceneId: string, kind: SceneProgressKind): string | undefined => {
    const isStitch = sceneId.endsWith("::stitch");
    const baseId = isStitch ? sceneId.replace(/::stitch$/, "") : sceneId;
    const effectiveKind: SceneProgressKind = isStitch ? "extend" : kind;
    const jobs = sceneJobsRef.current.get(baseId);
    if (!jobs) return undefined;
    return jobs[effectiveKind];
  }, []);

  const subscribeSceneJobs = useCallback((sceneId: string, callback: (jobs: SceneJobs) => void) => {
    subscribersRef.current.set(sceneId, callback);
    callback({ ...(sceneJobsRef.current.get(sceneId) || {}) });
    return () => {
      subscribersRef.current.delete(sceneId);
    };
  }, []);

  return { registerSceneJob, getSceneJob, subscribeSceneJobs };
}
