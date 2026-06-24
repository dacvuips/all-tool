import type { Dispatch, SetStateAction } from "react";

type ScriptDB = {
  set: (key: string, value: unknown) => Promise<void>;
};

export type SidebarScriptPatch = {
  aspectRatio?: string;
  serviceImageType?: string;
};

export type ScriptHistoryItem<T> = {
  id: string;
  createdAt: number;
  label: string;
  data: T;
};

type ScriptWithSidebarFields = {
  aspectRatio?: string;
  serviceImageType?: string;
};

export function applySidebarPatchToScript<T extends ScriptWithSidebarFields>(
  script: T,
  patch: SidebarScriptPatch
): T {
  return {
    ...script,
    ...(patch.aspectRatio !== undefined && { aspectRatio: patch.aspectRatio }),
    ...(patch.serviceImageType !== undefined && { serviceImageType: patch.serviceImageType }),
  };
}

/** Cập nhật scriptData đang hiển thị; chỉ sửa mục history đang chọn (nếu có), giữ nguyên các mục khác. */
export function syncSidebarPatchToCurrentScript<T extends ScriptWithSidebarFields>(options: {
  patch: SidebarScriptPatch;
  setScriptData: Dispatch<SetStateAction<T | null>>;
  selectedHistoryId: string | null;
  setSceneHistory: Dispatch<SetStateAction<ScriptHistoryItem<T>[]>>;
  scriptDB: ScriptDB;
  lastScriptCacheKey: string;
  historyCacheKey: string;
  logTag?: string;
}): void {
  const {
    patch,
    setScriptData,
    selectedHistoryId,
    setSceneHistory,
    scriptDB,
    lastScriptCacheKey,
    historyCacheKey,
    logTag = "affiliate",
  } = options;

  if (patch.aspectRatio === undefined && patch.serviceImageType === undefined) {
    return;
  }

  setScriptData((prev) => {
    if (!prev) return prev;
    const next = applySidebarPatchToScript(prev, patch);
    scriptDB
      .set(lastScriptCacheKey, next)
      .catch((err) => console.warn(`[${logTag}] Failed to persist current script`, err));
    return next;
  });

  if (!selectedHistoryId) return;

  setSceneHistory((prev) => {
    const updated = prev.map((item) =>
      item.id === selectedHistoryId
        ? { ...item, data: applySidebarPatchToScript(item.data, patch) }
        : item
    );
    scriptDB
      .set(historyCacheKey, updated)
      .catch((err) => console.warn(`[${logTag}] Failed to persist history`, err));
    return updated;
  });
}
