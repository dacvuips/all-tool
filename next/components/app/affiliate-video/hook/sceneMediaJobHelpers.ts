/**
 * sceneMediaJobHelpers.ts
 * Helper gắn onJobEnqueued cho batch/single generation.
 */
import type { SceneProgressKind } from "./useSceneProgressBroadcast";

type RegisterSceneJob = (sceneId: string, kind: SceneProgressKind, jobId: string | null) => void;

export function bindSceneJobEnqueue<T extends { onJobEnqueued?: (jobId: string) => void }>(
  params: T,
  sceneId: string,
  kind: SceneProgressKind,
  registerSceneJob?: RegisterSceneJob
): T {
  if (!registerSceneJob) return params;
  return {
    ...params,
    onJobEnqueued: (jobId: string) => {
      registerSceneJob(sceneId, kind, jobId);
      params.onJobEnqueued?.(jobId);
    },
  };
}
