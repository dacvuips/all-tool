import { getWolfPackageRemainingQuota } from "../../wolf-slide-out/wolf-workspace-generation";
import type { GeneratedVideoLike } from "../generatedMediaUtils";

export type AutoPostMediaType = "image" | "video";

export interface AutoPostPackageSnapshot {
  imageLimit?: number | null;
  imageCount?: number | null;
  videoLimit?: number | null;
  videoCount?: number | null;
}

export function getAutoPostRemainingQuota(
  pkg: AutoPostPackageSnapshot | null | undefined,
  mediaType: AutoPostMediaType
): { remaining: number; unlimited: boolean } {
  return getWolfPackageRemainingQuota({
    mediaType,
    imageLimit: pkg?.imageLimit,
    imageCount: pkg?.imageCount,
    videoLimit: pkg?.videoLimit,
    videoCount: pkg?.videoCount,
  });
}

export async function countScenesNeedingVideo(
  sceneIds: string[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<number> {
  let count = 0;
  for (const sceneId of sceneIds) {
    if (!(await getGeneratedVideo(sceneId))) count += 1;
  }
  return count;
}

type SceneVideoPostCheck = {
  id: string;
  disabled?: boolean;
  motion_description?: string;
  visual_prompt?: string;
};

function sceneHasVideoPrompt(scene: SceneVideoPostCheck): boolean {
  return !!(scene.motion_description?.trim() || scene.visual_prompt?.trim());
}

/** Chỉ đếm scene cần gen video (có prompt) nhưng chưa có video. */
export async function countScenesNeedingVideoForPost(
  sceneIds: string[],
  scenes: SceneVideoPostCheck[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<number> {
  let count = 0;
  for (const sceneId of sceneIds) {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene || scene.disabled || !sceneHasVideoPrompt(scene)) continue;
    if (!(await getGeneratedVideo(sceneId))) count += 1;
  }
  return count;
}

/** Bài đăng sẵn sàng nối/đăng: mọi scene cần video đã có ≥1 video. */
export async function isGroupReadyToPublish(
  sceneIds: string[],
  scenes: SceneVideoPostCheck[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<boolean> {
  const pending = await countScenesNeedingVideoForPost(sceneIds, scenes, getGeneratedVideo);
  if (pending > 0) return false;
  return (await countScenesWithVideo(sceneIds, getGeneratedVideo)) > 0;
}

export async function countScenesWithVideo(
  sceneIds: string[],
  getGeneratedVideo: (sceneId: string) => Promise<GeneratedVideoLike | null | undefined>
): Promise<number> {
  let count = 0;
  for (const sceneId of sceneIds) {
    if (await getGeneratedVideo(sceneId)) count += 1;
  }
  return count;
}

/** Xen kẽ sceneId giữa các bài đăng — luồng song song ưu tiên prompt từ nhiều bài khác nhau. */
export function interleaveSceneIdsAcrossGroups(groups: { sceneIds: string[] }[]): string[] {
  const queues = groups.map((g) => [...g.sceneIds]);
  const result: string[] = [];
  let hasMore = true;
  while (hasMore) {
    hasMore = false;
    for (const queue of queues) {
      if (queue.length > 0) {
        result.push(queue.shift()!);
        hasMore = true;
      }
    }
  }
  return result;
}

export function buildSceneToGroupMap(groups: { id: string; sceneIds: string[] }[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const sceneId of group.sceneIds) {
      map.set(sceneId, group.id);
    }
  }
  return map;
}
