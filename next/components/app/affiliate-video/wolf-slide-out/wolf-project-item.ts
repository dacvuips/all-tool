import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { MediaGenerationJobService } from "../../../../lib/repo/media-generation-job/media-generation-job.repo";
import { DB_NAME, STORE_NAME, uid } from "../constants";
import { GeneratedImageData, GeneratedVideoData } from "../copy-video/hook/useCopyVideoApi";
import { useIndexedDB } from "../hook/useIndexedDB";
import type { WolfMediaAsset } from "./wolf-media-library";
import type { WolfMediaType, WolfImageModelKey, WolfVideoMode } from "./wolf-workspace-generation";

export type WolfProjectItemStatus = "generating" | "ready" | "failed" | "cancelled";

/** Cấu hình lưu trên item để nút "Tạo lại" dùng đúng prompt/tham chiếu */
export type WolfItemGenerationConfig =
  | {
      mediaType: "image";
      imageModel: WolfImageModelKey;
      referenceAssetIds: string[];
    }
  | {
      mediaType: "video";
      videoMode: WolfVideoMode;
      referenceAssetIds: string[];
      startFrameAssetId?: string;
      endFrameAssetId?: string;
    };

export type WolfProjectItem = {
  id: string;
  projectId: string;
  sceneId: string;
  mediaType: WolfMediaType;
  prompt: string;
  status: WolfProjectItemStatus;
  aspectRatio?: "16:9" | "9:16";
  assetId?: string;
  jobId?: string;
  /** Nhóm item cùng một lần bấm Tạo — dùng check concurrency */
  generationBatchId?: string;
  generationConfig?: WolfItemGenerationConfig;
  createdAt: number;
  errorMessage?: string;
};

function isSameWolfProjectItem(a: WolfProjectItem, b: WolfProjectItem): boolean {
  return (
    a.id === b.id &&
    a.status === b.status &&
    a.jobId === b.jobId &&
    a.assetId === b.assetId &&
    a.errorMessage === b.errorMessage &&
    a.prompt === b.prompt
  );
}

function isSameWolfProjectItemList(a: WolfProjectItem[], b: WolfProjectItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id || !isSameWolfProjectItem(a[i], b[i])) return false;
  }
  return true;
}

export async function createWolfPendingItems(
  itemDB: { set: (key: string, value: WolfProjectItem) => Promise<void> },
  params: {
    projectId: string;
    mediaType: WolfMediaType;
    prompt: string;
    count: number;
    aspectRatio?: "16:9" | "9:16";
    generationBatchId?: string;
    jobId?: string;
    generationConfig?: WolfItemGenerationConfig;
  }
): Promise<WolfProjectItem[]> {
  const { projectId, mediaType, prompt, count, aspectRatio, generationBatchId, jobId, generationConfig } =
    params;
  const baseTime = Date.now();
  const items: WolfProjectItem[] = [];

  for (let i = 0; i < count; i++) {
    const item: WolfProjectItem = {
      id: uid(),
      projectId,
      sceneId: uid(),
      mediaType,
      prompt,
      aspectRatio,
      generationBatchId,
      generationConfig,
      status: "generating",
      jobId,
      createdAt: baseTime + i,
    };
    items.push(item);
    await itemDB.set(item.id, item);
  }

  return items;
}

export async function deleteWolfProjectItem(
  item: WolfProjectItem,
  stores: {
    itemDB: { remove: (key: string) => Promise<void> };
    sceneImageDB: { remove: (key: string) => Promise<void> };
    sceneVideoDB: { remove: (key: string) => Promise<void> };
    assetDB: { remove: (key: string) => Promise<void> };
  }
): Promise<void> {
  const { itemDB, sceneImageDB, sceneVideoDB, assetDB } = stores;
  if (item.mediaType === "image") {
    await sceneImageDB.remove(item.sceneId);
  } else {
    await sceneVideoDB.remove(item.sceneId);
  }
  if (item.assetId) {
    await assetDB.remove(item.assetId);
  }
  await itemDB.remove(item.id);
}

export async function stopWolfProjectItemsByJob(
  jobId: string,
  itemDB: { getAll: () => Promise<WolfProjectItem[]>; set: (key: string, value: WolfProjectItem) => Promise<void> },
  cancelledMessage: string
): Promise<WolfProjectItem[]> {
  try {
    await MediaGenerationJobService.cancelJob(jobId);
  } catch {
    // Job có thể đã xong hoặc không còn trên server
  }

  const allItems = await itemDB.getAll();
  const updated: WolfProjectItem[] = [];
  for (const entry of allItems) {
    if (entry.jobId !== jobId || entry.status !== "generating") continue;
    const cancelled: WolfProjectItem = {
      ...entry,
      status: "cancelled",
      errorMessage: cancelledMessage,
    };
    await itemDB.set(entry.id, cancelled);
    updated.push(cancelled);
  }
  return updated;
}

export function useWolfItemActions() {
  const { t } = useTranslation();
  const itemDB = useIndexedDB<WolfProjectItem>(STORE_NAME.wolfItems, DB_NAME.wolf);
  const sceneImageDB = useIndexedDB<GeneratedImageData>(STORE_NAME.wolfSceneImages, DB_NAME.wolf);
  const sceneVideoDB = useIndexedDB<GeneratedVideoData>(STORE_NAME.wolfSceneVideos, DB_NAME.wolf);
  const assetDB = useIndexedDB<WolfMediaAsset>(STORE_NAME.wolfAssets, DB_NAME.wolf);

  const stopItem = useCallback(
    async (item: WolfProjectItem): Promise<WolfProjectItem[]> => {
      if (item.status !== "generating") return [];

      if (item.jobId) {
        return stopWolfProjectItemsByJob(item.jobId, itemDB, t("Đã dừng"));
      }

      const cancelled: WolfProjectItem = {
        ...item,
        status: "cancelled",
        errorMessage: t("Đã dừng"),
      };
      await itemDB.set(item.id, cancelled);
      return [cancelled];
    },
    [itemDB, t]
  );

  const deleteItem = useCallback(
    async (item: WolfProjectItem): Promise<void> => {
      if (item.status === "generating" && item.jobId) {
        await stopWolfProjectItemsByJob(item.jobId, itemDB, t("Đã dừng"));
      }
      const latest = (await itemDB.get(item.id)) ?? item;
      await deleteWolfProjectItem(latest, { itemDB, sceneImageDB, sceneVideoDB, assetDB });
    },
    [assetDB, itemDB, sceneImageDB, sceneVideoDB, t]
  );

  return { stopItem, deleteItem };
}

export function useWolfProjectItems(projectId?: string | null) {
  const itemDB = useIndexedDB<WolfProjectItem>(STORE_NAME.wolfItems, DB_NAME.wolf);
  const sceneImageDB = useIndexedDB<GeneratedImageData>(
    STORE_NAME.wolfSceneImages,
    DB_NAME.wolf
  );
  const sceneVideoDB = useIndexedDB<GeneratedVideoData>(
    STORE_NAME.wolfSceneVideos,
    DB_NAME.wolf
  );
  const [items, setItems] = useState<WolfProjectItem[]>([]);
  const [sceneImages, setSceneImages] = useState<Record<string, GeneratedImageData>>({});
  const [sceneVideos, setSceneVideos] = useState<Record<string, GeneratedVideoData>>({});
  const [isLoading, setIsLoading] = useState(!!projectId);
  const isInitialLoadRef = useRef(true);
  const loadedProjectIdRef = useRef<string | null | undefined>(undefined);

  const prependItems = useCallback((newItems: WolfProjectItem[]) => {
    if (newItems.length === 0) return;
    setItems((prev) => {
      const newIds = new Set(newItems.map((item) => item.id));
      const merged = [...newItems, ...prev.filter((item) => !newIds.has(item.id))];
      return merged.sort((a, b) => b.createdAt - a.createdAt);
    });
  }, []);

  const patchSceneMedia = useCallback(
    (
      sceneId: string,
      media: { sceneImage?: GeneratedImageData; sceneVideo?: GeneratedVideoData }
    ) => {
      if (media.sceneImage) {
        setSceneImages((prev) => {
          if (prev[sceneId] === media.sceneImage) return prev;
          return { ...prev, [sceneId]: media.sceneImage! };
        });
      }
      if (media.sceneVideo) {
        setSceneVideos((prev) => {
          if (prev[sceneId] === media.sceneVideo) return prev;
          return { ...prev, [sceneId]: media.sceneVideo! };
        });
      }
    },
    []
  );

  const patchItem = useCallback(
    async (item: WolfProjectItem) => {
      let previousItem: WolfProjectItem | undefined;

      setItems((prev) => {
        const existing = prev.find((entry) => entry.id === item.id);
        previousItem = existing;
        if (existing && isSameWolfProjectItem(existing, item)) return prev;
        return prev.map((entry) => (entry.id === item.id ? item : entry));
      });

      if (item.status === "generating") {
        const wasGenerating = previousItem?.status === "generating";
        if (!wasGenerating) {
          if (item.mediaType === "image") {
            setSceneImages((prev) => {
              if (!(item.sceneId in prev)) return prev;
              const next = { ...prev };
              delete next[item.sceneId];
              return next;
            });
          } else {
            setSceneVideos((prev) => {
              if (!(item.sceneId in prev)) return prev;
              const next = { ...prev };
              delete next[item.sceneId];
              return next;
            });
          }
        }
        return;
      }

      if (item.status !== "ready") return;

      if (item.mediaType === "image") {
        const image = await sceneImageDB.get(item.sceneId);
        if (image) patchSceneMedia(item.sceneId, { sceneImage: image });
        return;
      }

      const video = await sceneVideoDB.get(item.sceneId);
      if (video) patchSceneMedia(item.sceneId, { sceneVideo: video });
    },
    [patchSceneMedia, sceneImageDB, sceneVideoDB]
  );

  const loadItemSceneMedia = useCallback(
    async (item: WolfProjectItem) => {
      if (item.status !== "ready") return;

      if (item.mediaType === "image") {
        const image = await sceneImageDB.get(item.sceneId);
        if (image) patchSceneMedia(item.sceneId, { sceneImage: image });
        return;
      }

      const video = await sceneVideoDB.get(item.sceneId);
      if (video) patchSceneMedia(item.sceneId, { sceneVideo: video });
    },
    [patchSceneMedia, sceneImageDB, sceneVideoDB]
  );

  const removeItemFromState = useCallback((item: WolfProjectItem) => {
    setItems((prev) => prev.filter((entry) => entry.id !== item.id));
    if (item.mediaType === "image") {
      setSceneImages((prev) => {
        if (!(item.sceneId in prev)) return prev;
        const next = { ...prev };
        delete next[item.sceneId];
        return next;
      });
    } else {
      setSceneVideos((prev) => {
        if (!(item.sceneId in prev)) return prev;
        const next = { ...prev };
        delete next[item.sceneId];
        return next;
      });
    }
  }, []);

  const refresh = useCallback(async () => {
    if (loadedProjectIdRef.current !== projectId) {
      isInitialLoadRef.current = true;
      loadedProjectIdRef.current = projectId;
    }

    if (!projectId) {
      setItems([]);
      setSceneImages({});
      setSceneVideos({});
      setIsLoading(false);
      isInitialLoadRef.current = true;
      return;
    }

    const showLoading = isInitialLoadRef.current;
    if (showLoading) setIsLoading(true);
    try {
      const allItems = await itemDB.getAll();
      const projectItems = allItems
        .filter((item) => item.projectId === projectId)
        .sort((a, b) => b.createdAt - a.createdAt);

      setItems((prev) => (isSameWolfProjectItemList(prev, projectItems) ? prev : projectItems));
      setSceneImages({});
      setSceneVideos({});
    } finally {
      if (showLoading) {
        setIsLoading(false);
        isInitialLoadRef.current = false;
      }
    }
  }, [itemDB, projectId, sceneImageDB, sceneVideoDB]);

  useEffect(() => {
    void refresh();
  }, [projectId]);

  return {
    items,
    sceneImages,
    sceneVideos,
    isLoading,
    refresh,
    prependItems,
    patchItem,
    patchSceneMedia,
    loadItemSceneMedia,
    removeItemFromState,
    itemDB,
    sceneImageDB,
    sceneVideoDB,
  };
}
