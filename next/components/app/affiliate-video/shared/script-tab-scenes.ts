/**
 * Tách danh sách scene theo tab right-panel (batch / images-to-video / video-to-video).
 * Mỗi tab persist vào field riêng trong analysis data để không ghi đè lẫn nhau.
 */

export type TabSceneListKey = "scenes" | "imagesToVideoScenes" | "videoToVideoScenes";

export interface TabbedScriptData {
  scenes?: unknown[];
  imagesToVideoScenes?: unknown[];
  videoToVideoScenes?: unknown[];
}

export interface ScriptTabEnumLike {
  batch: string;
  imagesToVideo: string;
  videoToVideo: string;
}

export function sceneListKeyForTab(
  tab: string,
  enumValues: ScriptTabEnumLike
): TabSceneListKey {
  if (tab === enumValues.imagesToVideo) return "imagesToVideoScenes";
  if (tab === enumValues.videoToVideo) return "videoToVideoScenes";
  return "scenes";
}

export function getScenesForTab<T>(
  data: TabbedScriptData | null | undefined,
  tab: string,
  enumValues: ScriptTabEnumLike
): T[] {
  if (!data) return [];
  const key = sceneListKeyForTab(tab, enumValues);
  const list = data[key];
  return (Array.isArray(list) ? list : []) as T[];
}

export function setScenesForTab<T extends TabbedScriptData>(
  data: T,
  tab: string,
  enumValues: ScriptTabEnumLike,
  scenes: unknown[]
): T {
  const key = sceneListKeyForTab(tab, enumValues);
  return { ...data, [key]: scenes };
}

/** Ghi danh sách scene vào đúng field theo tab (persist / sync) */
export function mergeSceneListIntoData<T extends TabbedScriptData>(
  data: T | null | undefined,
  sceneListKey: TabSceneListKey,
  scenes: unknown[]
): T {
  return { ...(data ?? { scenes: [] }), [sceneListKey]: scenes } as T;
}

/** Clone scenes với id suffix để media IndexedDB không trùng giữa các tab */
export function cloneScenesWithDistinctIds<T extends { id?: string }>(
  scenes: T[],
  idSuffix: string
): T[] {
  return scenes.map((s, i) => ({
    ...s,
    id: s.id ? `${s.id}-${idSuffix}` : `scene-${idSuffix}-${i}`,
  }));
}

/** Khởi tạo 3 mảng scene khi tạo script mới hoặc migrate dữ liệu cũ */
export function ensureTabSceneLists<T extends TabbedScriptData & { scenes: unknown[] }>(
  data: T
): T {
  const batch = data.scenes ?? [];
  if (!batch.length) return data;
  const hasItv = Array.isArray(data.imagesToVideoScenes) && data.imagesToVideoScenes.length > 0;
  const hasVtv = Array.isArray(data.videoToVideoScenes) && data.videoToVideoScenes.length > 0;
  if (hasItv && hasVtv) return data;
  return {
    ...data,
    scenes: batch,
    imagesToVideoScenes: hasItv
      ? data.imagesToVideoScenes
      : cloneScenesWithDistinctIds(batch as { id?: string }[], "itv"),
    videoToVideoScenes: hasVtv
      ? data.videoToVideoScenes
      : cloneScenesWithDistinctIds(batch as { id?: string }[], "vtv"),
  };
}

export const ELEMENT_SCRIPT_TAB_ENUM = {
  batch: "batch",
  imagesToVideo: "images-to-video",
  videoToVideo: "video-to-video",
} as const;

export const REVIEW_SCRIPT_TAB_ENUM = {
  batch: "batch",
  imagesToVideo: "images-to-video",
  videoToVideo: "video-to-video",
} as const;
