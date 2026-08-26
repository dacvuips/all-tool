import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowLeftLine, RiLoader4Line } from "react-icons/ri";

import { DB_NAME, STORE_NAME } from "../constants";
import { useIndexedDB } from "../hook/useIndexedDB";
import { useLazyInView } from "./use-lazy-in-view";
import { useWolfProjectBatchActions } from "./use-wolf-project-batch-actions";
import { WolfProject } from "./wolf-project-grid";
import { useWolfItemActions, useWolfProjectItems, WolfProjectItem } from "./wolf-project-item";
import { WolfProjectBatchToolbar } from "./wolf-project-batch-toolbar";
import { WolfProjectItemCard } from "./wolf-project-item-card";
import { WolfWorkspaceComposer } from "./wolf-workspace-composer";
import { useWolfWorkspaceGeneration } from "./wolf-workspace-generation";

type WolfWorkspaceProps = {
  projectId?: string | null;
  onBack: () => void;
};

function getItemAspectPadding(item: WolfProjectItem) {
  const aspectRatio = item.aspectRatio ?? "16:9";
  if (aspectRatio === "16:9") return "56.25%";
  return item.mediaType === "video" ? "174.78%" : "177.78%";
}

function LazyWolfProjectItemCard({
  item,
  sceneImage,
  sceneVideo,
  progress,
  isActionPending,
  scrollRoot,
  loadItemSceneMedia,
  onStop,
  onRetry,
  onDelete,
}: {
  item: WolfProjectItem;
  sceneImage?: Parameters<typeof WolfProjectItemCard>[0]["sceneImage"];
  sceneVideo?: Parameters<typeof WolfProjectItemCard>[0]["sceneVideo"];
  progress?: number;
  isActionPending?: boolean;
  scrollRoot: HTMLDivElement | null;
  loadItemSceneMedia: (item: WolfProjectItem) => Promise<void>;
  onStop?: () => void;
  onRetry?: () => void;
  onDelete?: () => void;
}) {
  const { ref, inView } = useLazyInView<HTMLDivElement>("320px", scrollRoot);
  const [mediaRequested, setMediaRequested] = useState(false);

  useEffect(() => {
    setMediaRequested(false);
  }, [item.id, item.sceneId]);

  useEffect(() => {
    if (mediaRequested || item.status !== "ready") return;
    if (!inView && !sceneImage && !sceneVideo) return;
    setMediaRequested(true);
    void loadItemSceneMedia(item);
  }, [inView, item, loadItemSceneMedia, mediaRequested, sceneImage, sceneVideo]);

  const hasSceneMedia = item.mediaType === "image" ? !!sceneImage : !!sceneVideo;
  const isMediaLoading = item.status === "ready" && mediaRequested && !hasSceneMedia;
  const shouldShowPlaceholder =
    item.status === "ready" && !hasSceneMedia && !inView && !isMediaLoading;

  if (shouldShowPlaceholder) {
    return (
      <div
        ref={ref}
        className="overflow-hidden w-full rounded-2xl border shadow-sm animate-pulse border-slate-200 bg-slate-100"
        style={{ paddingTop: getItemAspectPadding(item) }}
        aria-hidden
      />
    );
  }

  if (isMediaLoading) {
    return (
      <div
        ref={ref}
        className="overflow-hidden bg-white rounded-2xl border shadow-sm border-slate-200"
      >
        <div className="relative p-2 w-full bg-slate-50">
          <div
            className="overflow-hidden relative w-full rounded-md bg-slate-100"
            style={{ paddingTop: getItemAspectPadding(item) }}
          >
            <div className="flex absolute inset-0 justify-center items-center">
              <RiLoader4Line className="text-lg animate-spin text-slate-400" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={ref}>
      <WolfProjectItemCard
        item={item}
        sceneImage={sceneImage}
        sceneVideo={sceneVideo}
        progress={progress}
        isActionPending={isActionPending}
        onStop={onStop}
        onRetry={onRetry}
        onDelete={onDelete}
      />
    </div>
  );
}

export function WolfWorkspace({ projectId, onBack }: WolfWorkspaceProps) {
  const { t } = useTranslation();
  const [listScrollRoot, setListScrollRoot] = useState<HTMLDivElement | null>(null);
  const [projectName, setProjectName] = useState<string>("");
  const [itemProgress, setItemProgress] = useState<Record<string, number>>({});
  const [actionItemId, setActionItemId] = useState<string | null>(null);
  const projectDB = useIndexedDB<WolfProject>(STORE_NAME.wolf, DB_NAME.wolf);
  const {
    items,
    sceneImages,
    sceneVideos,
    isLoading,
    prependItems,
    patchItem,
    patchSceneMedia,
    loadItemSceneMedia,
    removeItemFromState,
    sceneImageDB,
    sceneVideoDB,
  } = useWolfProjectItems(projectId);
  const { stopItem, stopAllGeneratingItems, deleteItem } = useWolfItemActions();
  const { generating, progress, submit, retryItem } = useWolfWorkspaceGeneration();

  const getSceneImage = useCallback(
    async (sceneId: string) => {
      if (sceneImages[sceneId]) return sceneImages[sceneId];
      return sceneImageDB.get(sceneId);
    },
    [sceneImages, sceneImageDB]
  );

  const getSceneVideo = useCallback(
    async (sceneId: string) => {
      if (sceneVideos[sceneId]) return sceneVideos[sceneId];
      return sceneVideoDB.get(sceneId);
    },
    [sceneVideos, sceneVideoDB]
  );

  const handleItemUpdated = useCallback(
    (item: WolfProjectItem) => {
      setItemProgress((prev) => {
        if (!(item.id in prev)) return prev;
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
      void patchItem(item);
    },
    [patchItem]
  );

  const {
    downloading,
    downloadingVideo,
    deletingAll,
    stoppingAll,
    generatingCount,
    downloadLabel,
    downloadVideoLabel,
    availableImageCount,
    availableVideoCount,
    handleDownloadAllImages,
    handleDownloadAllImages2k,
    handleDownloadAllImages4k,
    handleDownloadAllImagesZip,
    handleDownloadAllImages2kZip,
    handleDownloadAllImages4kZip,
    handleDownloadAllVideos,
    handleDownloadAllVideosZip,
    handleDownloadAllVideos1080p,
    handleDownloadAllVideos1080pZip,
    handleDeleteAllProjectMedia,
    handleStopAllGenerating,
  } = useWolfProjectBatchActions({
    items,
    sceneImages,
    sceneVideos,
    getSceneImage,
    getSceneVideo,
    deleteItem,
    removeItemFromState,
    stopAllGeneratingItems,
    onItemsStopped: (updated) => {
      for (const entry of updated) handleItemUpdated(entry);
    },
    isBusy: generating,
  });

  useEffect(() => {
    if (!projectId) {
      setProjectName("");
      return;
    }

    let cancelled = false;
    void projectDB.get(projectId).then((project) => {
      if (!cancelled) setProjectName(project?.name ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [projectDB, projectId]);

  const handleItemProgress = useCallback((itemIds: string[], progress: number) => {
    setItemProgress((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const id of itemIds) {
        if (next[id] === progress) continue;
        next[id] = progress;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, []);

  const handleSceneMediaUpdated = useCallback(
    (sceneId: string, media: Parameters<typeof patchSceneMedia>[1]) => {
      patchSceneMedia(sceneId, media);
    },
    [patchSceneMedia]
  );

  const handleGenerationItemsCreated = useCallback(
    (newItems: WolfProjectItem[]) => {
      prependItems(newItems);
      requestAnimationFrame(() => {
        listScrollRoot?.scrollTo({ top: 0, behavior: "auto" });
      });
    },
    [listScrollRoot, prependItems]
  );

  const handleStopItem = useCallback(
    async (item: WolfProjectItem) => {
      setActionItemId(item.id);
      try {
        const updated = await stopItem(item);
        for (const entry of updated) handleItemUpdated(entry);
      } finally {
        setActionItemId(null);
      }
    },
    [handleItemUpdated, stopItem]
  );

  const handleDeleteItem = useCallback(
    async (item: WolfProjectItem) => {
      if (!confirm(t("Xóa item này khỏi dự án?"))) return;

      setActionItemId(item.id);
      try {
        await deleteItem(item);
        setItemProgress((prev) => {
          if (!(item.id in prev)) return prev;
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        removeItemFromState(item);
      } finally {
        setActionItemId(null);
      }
    },
    [deleteItem, removeItemFromState, t]
  );

  const handleRetryItem = useCallback(
    async (item: WolfProjectItem) => {
      setActionItemId(item.id);
      try {
        await retryItem({
          item,
          onItemUpdated: handleItemUpdated,
          onSceneMediaUpdated: handleSceneMediaUpdated,
          onItemProgress: handleItemProgress,
        });
      } finally {
        setActionItemId(null);
      }
    },
    [handleItemProgress, handleItemUpdated, handleSceneMediaUpdated, retryItem]
  );

  const hasItems = items.length > 0;

  return (
    <div className="flex relative flex-col h-full bg-white">
      <button
        type="button"
        onClick={onBack}
        className="absolute left-4 top-4 z-10 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition-colors hover:border-slate-300 hover:text-slate-800"
      >
        <RiArrowLeftLine />
        {t("Dự án")}
      </button>

      {hasItems && (
        <div className="absolute right-4 top-4 z-10 max-w-[calc(100%-8rem)]">
          <WolfProjectBatchToolbar
            downloading={downloading}
            downloadingVideo={downloadingVideo}
            deletingAll={deletingAll}
            stoppingAll={stoppingAll}
            generatingCount={generatingCount}
            downloadLabel={downloadLabel}
            downloadVideoLabel={downloadVideoLabel}
            availableImageCount={availableImageCount}
            availableVideoCount={availableVideoCount}
            disabled={generating}
            onDownloadAllImages={() => void handleDownloadAllImages()}
            onDownloadAllImages2k={() => void handleDownloadAllImages2k()}
            onDownloadAllImages4k={() => void handleDownloadAllImages4k()}
            onDownloadAllImagesZip={() => void handleDownloadAllImagesZip()}
            onDownloadAllImages2kZip={() => void handleDownloadAllImages2kZip()}
            onDownloadAllImages4kZip={() => void handleDownloadAllImages4kZip()}
            onDownloadAllVideos={() => void handleDownloadAllVideos()}
            onDownloadAllVideos1080p={() => void handleDownloadAllVideos1080p()}
            onDownloadAllVideosZip={() => void handleDownloadAllVideosZip()}
            onDownloadAllVideos1080pZip={() => void handleDownloadAllVideos1080pZip()}
            onDeleteAllProjectMedia={() => void handleDeleteAllProjectMedia()}
            onStopAllGenerating={() => void handleStopAllGenerating()}
          />
        </div>
      )}

      <div
        ref={setListScrollRoot}
        className={`flex flex-1 flex-col px-4 pt-14 pb-56 ${
          hasItems ? "overflow-auto v-scrollbar" : "justify-center items-center px-6 text-center"
        }`}
      >
        {isLoading ? (
          <div className="flex flex-1 justify-center items-center text-sm text-slate-400">
            {t("Đang tải...")}
          </div>
        ) : hasItems ? (
          <div className="grid grid-cols-1 gap-3 w-full sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {items.map((item) => (
              <LazyWolfProjectItemCard
                key={item.id}
                item={item}
                sceneImage={sceneImages[item.sceneId]}
                sceneVideo={sceneVideos[item.sceneId]}
                progress={itemProgress[item.id]}
                isActionPending={actionItemId === item.id}
                scrollRoot={listScrollRoot}
                loadItemSceneMedia={loadItemSceneMedia}
                onStop={() => void handleStopItem(item)}
                onRetry={() => void handleRetryItem(item)}
                onDelete={() => void handleDeleteItem(item)}
              />
            ))}
          </div>
        ) : (
          <>
            <p className="max-w-xs text-sm leading-relaxed text-slate-500">
              {t("Bắt đầu tạo hoặc thả nội dung nghe nhìn")}
            </p>
          </>
        )}
      </div>

      <div className="absolute inset-x-0 bottom-14 z-30">
        <WolfWorkspaceComposer
          projectId={projectId}
          projectName={projectName}
          generating={generating}
          progress={progress}
          submit={submit}
          onGenerationItemsCreated={handleGenerationItemsCreated}
          onGenerationItemProgress={handleItemProgress}
          onGenerationItemUpdated={handleItemUpdated}
          onGenerationSceneMediaUpdated={handleSceneMediaUpdated}
        />
      </div>
    </div>
  );
}
