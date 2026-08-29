/**
 * shared/batch-list.tsx
 * Shared Batch List Panel – danh sách scene dạng bảng
 * Dùng chung cho single, copy-video, trending
 * className only – Tailwind CSS, no inline styles
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiVideoFill } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { reorderScenesWithNumbers, SortableCardGrid } from "../../../shared/utilities/sortable";
import { CharacterItem } from "../constants";
import { ActionImageEnum } from "../elements/constants";
import { BatchListHeader, type BatchListHistoryConfig } from "./batch-list-header";
import {
  getAutoDownloadDefault,
  setAutoDownloadDefault,
  setAutoDownloadImageResolutionDefault,
  setAutoDownloadVideoResolutionDefault,
  type AutoDownloadImageResolution,
  type VideoDownloadResolution,
} from "./autoDownloadUtils";
import { LazySceneCard } from "./lazy-scene-card";
import {
  BATCH_SCENE_PAGE_SIZE,
  BATCH_SCENE_PAGINATION_THRESHOLD,
  BatchScenePagination,
} from "./batch-scene-pagination";
import { SceneTabKey } from "./scene-card-tabs";
import {
  AutoPostSocialGroupedList,
  SocialPostGroup,
} from "./auto-post-social/grouped-list";
import { useAutoPostSocialBatchList } from "./auto-post-social/use-auto-post-social-batch-list";

export type { BatchListHistoryConfig };

// ── Types ──────────────────────────────────────────────────────────────────

export interface SharedBatchListPanelProps {
  /** Scene list (SceneScript or CopyVideoScene) */
  scenes: any[];
  /** Character list for insert scene */
  characters: CharacterItem[];
  /** Hide the "HÌNH ẢNH" column (e.g. for prompt_to_video mode) */
  hideImageColumn?: boolean;
  /** Unique key for selected history (used as React key prefix) */
  selectedHistoryId?: string | null;

  /** Dropdown lịch sử từ IndexedDB (truyền từ wrapper / provider) */
  history?: BatchListHistoryConfig;

  // ── Persistence callbacks ──

  /** Called after toggle operations (disable, voiceDisable, noText, product images).
   *  The wrapper should persist to IndexedDB (read-merge-write). */
  onPersistScenes: (updatedScenes: any[]) => Promise<void> | void;

  /** Called after update scene field / insert scene where parent state also needs syncing.
   *  The wrapper should persist to IndexedDB AND update parent context state. */
  onSyncScenes: (updatedScenes: any[]) => Promise<void> | void;

  /** Called to build a new scene via AI API. Should handle errors internally
   *  and return a fallback scene on failure. */
  onBuildInsertedScene: (
    data: {
      description: string;
      voiceover: string;
      cameraAngle: string;
      selectedCharacters: string[];
      audio: string;
    },
    sceneNumber: number,
    prevScene?: any,
    nextScene?: any
  ) => Promise<any>;

  // ── Component overrides ──

  /** The BatchActionBar component to render */
  ActionBarComponent: React.ComponentType<{ scenes: any[] }>;

  /** The SceneRowGroup component to render for each scene */
  SceneRowComponent: React.ComponentType<any>;

  /** Extra props to pass to each SceneRowComponent (e.g. storyModeType) */
  sceneRowExtraProps?: Record<string, any>;

  /** Mở tour hướng dẫn sử dụng panel */
  onOpenIntro?: () => void;

  /** ID nút kéo thả (intro tour) */
  getDragHandleId?: (item: any, index: number) => string | undefined;

  /** Chỉ mount scene row khi gần viewport — giảm RAM với danh sách dài */
  lazyMountSceneRows?: boolean;

  /** Hiện select giọng áp dụng cho tất cả phân cảnh (mode Thành phần) */
  showBatchVideoVoice?: boolean;
  /** Tab media mặc định khi mở panel (vd. tab Ảnh) */
  defaultGlobalTab?: SceneTabKey | null;
  /** Nhóm metadata đăng MXH (lưu scriptData). Chỉ tab Hàng Loạt truyền autoPostListLayout. */
  socialPostGroups?: SocialPostGroup[];
  onSocialPostGroupsChange?: (groups: SocialPostGroup[]) => void;
  /** Chỉ tab Hàng Loạt: bật Tự động đăng MXH thì đổi card → danh sách. Tab khác giữ card. */
  autoPostListLayout?: boolean;
}

// ── Main Component ─────────────────────────────────────────────────────────

export function SharedBatchListPanel({
  scenes,
  characters,
  hideImageColumn = false,
  selectedHistoryId,
  history,
  onPersistScenes,
  onSyncScenes,
  onBuildInsertedScene,
  ActionBarComponent,
  SceneRowComponent,
  sceneRowExtraProps,
  onOpenIntro,
  getDragHandleId,
  lazyMountSceneRows = false,
  showBatchVideoVoice = false,
  defaultGlobalTab = null,
  socialPostGroups,
  onSocialPostGroupsChange,
  autoPostListLayout = false,
}: SharedBatchListPanelProps) {
  const { t } = useTranslation();
  const [sceneList, setSceneList] = useState<any[]>(scenes);
  const { listConfig } = useAutoPostSocialBatchList({
    scenes: sceneList,
    socialPostGroups,
    onSocialPostGroupsChange,
  });
  const autoPostList = autoPostListLayout ? listConfig : null;
  const [globalTab, setGlobalTab] = useState<SceneTabKey | null>(defaultGlobalTab);
  const [currentPage, setCurrentPage] = useState(1);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const { customer } = useAuth();

  const paginationEnabled =
    !autoPostList?.enabled && sceneList.length > BATCH_SCENE_PAGINATION_THRESHOLD;
  const totalPages = paginationEnabled
    ? Math.ceil(sceneList.length / BATCH_SCENE_PAGE_SIZE)
    : 1;

  const paginatedScenes = useMemo(() => {
    if (!paginationEnabled) return sceneList;
    const safePage = Math.min(Math.max(1, currentPage), totalPages);
    const start = (safePage - 1) * BATCH_SCENE_PAGE_SIZE;
    return sceneList.slice(start, start + BATCH_SCENE_PAGE_SIZE);
  }, [sceneList, paginationEnabled, currentPage, totalPages]);

  useEffect(() => {
    setCurrentPage(1);
  }, [scenes, selectedHistoryId]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(Math.max(1, totalPages));
    }
  }, [currentPage, totalPages]);

  const handlePageChange = useCallback((page: number) => {
    setCurrentPage(page);
    gridContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const pendingSlotUpdatesRef = useRef(
    new Map<
      string,
      { slots: any[]; imageUrls: string[]; actionMode?: ActionImageEnum }
    >()
  );
  const slotFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (slotFlushTimerRef.current) clearTimeout(slotFlushTimerRef.current);
    };
  }, []);
  // Sync local sceneList when parent scenes prop changes (e.g. switching history items)
  useEffect(() => {
    setSceneList(scenes);
  }, [scenes]);

  /** Toggle disabled state on a scene and persist to IndexedDB */
  const handleToggleDisable = async (sceneId: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, disabled: !s.disabled } : s));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleDisable] Failed to persist:", err);
    }
  };

  /** Toggle voiceDisable state on a single scene and persist to IndexedDB */
  const handleToggleVoiceDisable = async (sceneId: string) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, voiceDisable: !s.voiceDisable } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleVoiceDisable] Failed to persist:", err);
    }
  };

  /** Toggle voiceDisable for ALL scenes at once */
  const handleToggleAllVoiceDisable = async () => {
    const allDisabled = sceneList.every((s) => s.voiceDisable);
    const updated = sceneList.map((s) => ({ ...s, voiceDisable: !allDisabled }));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleAllVoiceDisable] Failed to persist:", err);
    }
  };

  /** Đặt videoVoice cho TẤT CẢ phân cảnh (mode Thành phần) */
  const handleSetAllVideoVoice = async (voiceId: string) => {
    const next = String(voiceId || "").trim().toLowerCase();
    const updated = sceneList.map((s) => ({
      ...s,
      videoVoice: next || undefined,
    }));
    setSceneList(updated);
    try {
      await onSyncScenes(updated);
    } catch (err) {
      console.error("[handleSetAllVideoVoice] Failed to persist:", err);
    }
  };

  /** Toggle noText state on a single scene and persist to IndexedDB */
  const handleToggleNoText = async (sceneId: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, noText: !s.noText } : s));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleNoText] Failed to persist:", err);
    }
  };

  /** Toggle noText for ALL scenes at once */
  const handleToggleAllNoText = async () => {
    const allDisabled = sceneList.every((s) => s.noText);
    const updated = sceneList.map((s) => ({ ...s, noText: !allDisabled }));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleAllNoText] Failed to persist:", err);
    }
  };

  /** Toggle auto-download on a single scene and persist */
  const handleToggleNoDownload = async (sceneId: string) => {
    const defaultEnabled = getAutoDownloadDefault();
    const updated = sceneList.map((s) => {
      if (s.id !== sceneId) return s;
      const current = s.noDownload ?? defaultEnabled;
      return { ...s, noDownload: !current };
    });
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleNoDownload] Failed to persist:", err);
    }
  };

  /** Toggle auto-download for ALL scenes + lưu mặc định localStorage */
  const handleToggleAllNoDownload = async () => {
    const defaultEnabled = getAutoDownloadDefault();
    const allEnabled = sceneList.every((s) => s.noDownload ?? defaultEnabled);
    const newValue = !allEnabled;
    setAutoDownloadDefault(newValue);
    const updated = sceneList.map((s) => ({ ...s, noDownload: newValue }));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleToggleAllNoDownload] Failed to persist:", err);
    }
  };

  /** Đặt độ phân giải ảnh cho TẤT CẢ scene + lưu mặc định toàn cục */
  const handleSetAllAutoDownloadImageResolution = async (
    resolution: AutoDownloadImageResolution
  ) => {
    setAutoDownloadImageResolutionDefault(resolution);
    const updated = sceneList.map((s) => ({ ...s, autoDownloadImageResolution: resolution }));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleSetAllAutoDownloadImageResolution] Failed to persist:", err);
    }
  };

  /** Đặt độ phân giải video cho TẤT CẢ scene + lưu mặc định toàn cục */
  const handleSetAllAutoDownloadVideoResolution = async (
    resolution: VideoDownloadResolution
  ) => {
    setAutoDownloadVideoResolutionDefault(resolution);
    const updated = sceneList.map((s) => ({ ...s, autoDownloadVideoResolution: resolution }));
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleSetAllAutoDownloadVideoResolution] Failed to persist:", err);
    }
  };

  /** Đặt độ phân giải ảnh chỉ cho một scene */
  const handleSetSceneAutoDownloadImageResolution = async (
    sceneId: string,
    resolution: AutoDownloadImageResolution
  ) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, autoDownloadImageResolution: resolution } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleSetSceneAutoDownloadImageResolution] Failed to persist:", err);
    }
  };

  /** Đặt độ phân giải video chỉ cho một scene */
  const handleSetSceneAutoDownloadVideoResolution = async (
    sceneId: string,
    resolution: VideoDownloadResolution
  ) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, autoDownloadVideoResolution: resolution } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleSetSceneAutoDownloadVideoResolution] Failed to persist:", err);
    }
  };

  /** Insert a new scene above/below a target scene */
  const handleInsert = async (
    targetScene: any,
    position: "above" | "below",
    data: {
      description: string;
      voiceover: string;
      cameraAngle: string;
      selectedCharacters: string[];
      audio: string;
    }
  ) => {
    const idx = sceneList.findIndex((s) => s.id === targetScene.id);
    const insertAt = position === "above" ? idx : idx + 1;
    const newSceneNumber = insertAt + 1;
    const prevScene = insertAt > 0 ? sceneList[insertAt - 1] : undefined;
    const nextScene = insertAt < sceneList.length ? sceneList[insertAt] : undefined;

    const newScene = await onBuildInsertedScene(data, newSceneNumber, prevScene, nextScene);

    const updated = [...sceneList.slice(0, insertAt), newScene, ...sceneList.slice(insertAt)].map(
      (s, i) => ({ ...s, sceneNumber: i + 1 })
    );

    setSceneList(updated);

    try {
      await onSyncScenes(updated);
    } catch (err) {
      console.error("[handleInsert] Failed to persist:", err);
    }
  };

  /** Update a field on a single scene */
  const handleUpdateScene = async (sceneId: string, field: string, value: string) => {
    const updated = sceneList.map((s) => (s.id === sceneId ? { ...s, [field]: value } : s));
    setSceneList(updated);
    try {
      await onSyncScenes(updated);
    } catch (err) {
      console.error("[handleUpdateScene] Failed to persist:", err);
    }
  };

  /** Delete a scene, renumber remaining, sync UI + IndexedDB */
  const handleDeleteScene = async (sceneId: string) => {
    const updated = sceneList
      .filter((s) => s.id !== sceneId)
      .map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    setSceneList(updated);
    try {
      if (onSocialPostGroupsChange && socialPostGroups?.length) {
        onSocialPostGroupsChange(
          socialPostGroups.map((g) => ({
            ...g,
            sceneIds: g.sceneIds.filter((id) => id !== sceneId),
          }))
        );
      }
      await onSyncScenes(updated);
    } catch (err) {
      console.error("[handleDeleteScene] Failed to persist:", err);
    }
  };

  /** Update selected product images for a scene and persist to IndexedDB */
  const handleUpdateSelectedProductImages = async (sceneId: string, images: string[]) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, selectedProductImages: images } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleUpdateSelectedProductImages] Failed to persist:", err);
    }
  };

  /** Update element image slots — gộp nhiều scene, ghi IndexedDB một lần (debounce) */
  const flushPendingElementImageSlots = useCallback(() => {
    const pending = pendingSlotUpdatesRef.current;
    if (pending.size === 0) return;

    const updates = new Map(pending);
    pending.clear();

    setSceneList((prev) => {
      let updated = prev;
      updates.forEach((data, sceneId) => {
        updated = updated.map((s) =>
          s.id === sceneId
            ? {
                ...s,
                elementImageSlots: data.slots,
                selectedProductImages: data.imageUrls,
                elementImageSlotsActionMode: data.actionMode ?? s.elementImageSlotsActionMode,
              }
            : s
        );
      });
      void Promise.resolve(onPersistScenes(updated)).catch((err) =>
        console.error("[handleUpdateElementImageSlots] Failed to persist:", err)
      );
      return updated;
    });
  }, [onPersistScenes]);

  const handleUpdateElementImageSlots = useCallback(
    (
      sceneId: string,
      slots: any[],
      imageUrls: string[],
      actionMode?: ActionImageEnum
    ) => {
      pendingSlotUpdatesRef.current.set(sceneId, { slots, imageUrls, actionMode });
      if (slotFlushTimerRef.current) clearTimeout(slotFlushTimerRef.current);
      slotFlushTimerRef.current = setTimeout(flushPendingElementImageSlots, 400);
    },
    [flushPendingElementImageSlots]
  );

  /** Update review image slots (3 ô ảnh tham chiếu) + derived product image URLs */
  const handleUpdateReviewImageSlots = async (
    sceneId: string,
    slots: any[],
    imageUrls: string[]
  ) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, reviewImageSlots: slots, selectedProductImages: imageUrls } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleUpdateReviewImageSlots] Failed to persist:", err);
    }
  };

  /** Update element video slots (1 ô video tham chiếu) */
  const handleUpdateElementVideoSlots = async (sceneId: string, slots: any[]) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, elementVideoSlots: slots } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleUpdateElementVideoSlots] Failed to persist:", err);
    }
  };

  const handleReorderScenes = useCallback(
    (reordered: any[]) => {
      setSceneList((prev) => {
        let updated: any[];
        if (paginationEnabled) {
          const start = (currentPage - 1) * BATCH_SCENE_PAGE_SIZE;
          const end = start + reordered.length;
          updated = reorderScenesWithNumbers([
            ...prev.slice(0, start),
            ...reordered,
            ...prev.slice(end),
          ]);
        } else {
          updated = reorderScenesWithNumbers(reordered);
        }
        void Promise.resolve(onSyncScenes(updated)).catch((err) =>
          console.error("[handleReorderScenes] Failed to persist:", err)
        );
        return updated;
      });
    },
    [onSyncScenes, paginationEnabled, currentPage]
  );

  const getSceneId = useCallback((scene: { id: string }) => scene.id, []);

  const renderSceneRow = useCallback(
    (scene: any, _index: number) => {
      const globalIndex = sceneList.findIndex((s) => s.id === scene.id);
      const nextSceneId =
        globalIndex >= 0 && globalIndex < sceneList.length - 1
          ? sceneList[globalIndex + 1].id
          : undefined;

      const row = (
        <SceneRowComponent
          scene={scene}
          index={globalIndex >= 0 ? globalIndex : _index}
          nextSceneId={nextSceneId}
          isDisabled={!!scene.disabled}
          characters={characters}
          hideImageColumn={hideImageColumn}
          onInsert={handleInsert}
          onUpdateScene={handleUpdateScene}
          onToggleDisable={handleToggleDisable}
          onToggleVoiceDisable={handleToggleVoiceDisable}
          onToggleNoText={handleToggleNoText}
          onToggleNoDownload={handleToggleNoDownload}
          onSetSceneAutoDownloadImageResolution={handleSetSceneAutoDownloadImageResolution}
          onSetSceneAutoDownloadVideoResolution={handleSetSceneAutoDownloadVideoResolution}
          onUpdateSelectedProductImages={handleUpdateSelectedProductImages}
          onUpdateElementImageSlots={handleUpdateElementImageSlots}
          onUpdateReviewImageSlots={handleUpdateReviewImageSlots}
          onUpdateElementVideoSlots={handleUpdateElementVideoSlots}
          onDeleteScene={handleDeleteScene}
          forcedTab={globalTab}
          layout={autoPostList?.enabled ? "row" : "card"}
          {...sceneRowExtraProps}
        />
      );

      if (!lazyMountSceneRows || autoPostList?.enabled) return row;

      return (
        <LazySceneCard sceneNumber={scene.sceneNumber}>
          {row}
        </LazySceneCard>
      );
    },
    [
      sceneList,
      characters,
      hideImageColumn,
      globalTab,
      sceneRowExtraProps,
      autoPostList?.enabled,
      handleInsert,
      handleUpdateScene,
      handleToggleDisable,
      handleToggleVoiceDisable,
      handleToggleNoText,
      handleToggleNoDownload,
      handleSetSceneAutoDownloadImageResolution,
      handleSetSceneAutoDownloadVideoResolution,
      handleUpdateSelectedProductImages,
      handleUpdateElementImageSlots,
      handleUpdateReviewImageSlots,
      handleUpdateElementVideoSlots,
      handleDeleteScene,
      lazyMountSceneRows,
    ]
  );

  const renderSceneDragOverlay = useCallback(
    (scene: { sceneNumber?: number }) => (
      <div className="flex justify-center items-center w-full h-full min-h-[100px] rounded-xl bg-gradient-to-br from-gray-50 to-white border border-gray-200">
        <span className="px-3 py-1.5 text-xs font-bold text-white bg-gray-800 rounded-full">
          {t("Cảnh")} #{scene.sceneNumber}
        </span>
      </div>
    ),
    [t]
  );

  if (!customer) {
    return (
      <div className="flex flex-col justify-center items-center py-16">
        <span className="text-sm font-medium text-gray-400">
          {t("Vui lòng đăng nhập để sử dụng tính năng này")}
        </span>
      </div>
    );
  }

  // ── Empty state ──
  if (sceneList.length === 0) {
    return (
      <div className="flex flex-col justify-center items-center py-20 text-gray-400">
        <RiVideoFill className="mb-3 text-5xl opacity-30" />
        <div className="mb-1 text-sm font-medium text-gray-500">{t("Chưa có scene nào")}</div>
        <div className="text-xs text-gray-400">{t("Chuyển sang tab Kịch Bản để tạo nội dung")}</div>
      </div>
    );
  }

  // ── Render ──
  return (
    <div className="flex overflow-auto flex-col h-full v-scrollbar">
      <BatchListHeader
        scenes={sceneList}
        history={history}
        globalTab={globalTab}
        onGlobalTabChange={setGlobalTab}
        onToggleAllNoText={handleToggleAllNoText}
        onToggleAllVoiceDisable={handleToggleAllVoiceDisable}
        ActionBarComponent={ActionBarComponent}
        onToggleAllNoDownload={handleToggleAllNoDownload}
        onSetAllAutoDownloadImageResolution={handleSetAllAutoDownloadImageResolution}
        onSetAllAutoDownloadVideoResolution={handleSetAllAutoDownloadVideoResolution}
        showBatchVideoVoice={showBatchVideoVoice}
        onSetAllVideoVoice={handleSetAllVideoVoice}
        showSocialPostScenesToggle={!!autoPostList?.enabled}
        onOpenIntro={onOpenIntro}
      />

      {paginationEnabled && (
        <BatchScenePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={BATCH_SCENE_PAGE_SIZE}
          totalCount={sceneList.length}
          onPageChange={handlePageChange}
        />
      )}

      {/* ── Danh sách scene: flat grid hoặc nhóm đăng MXH ── */}
      <div id="batch-scene-grid" ref={gridContainerRef} className="flex-1 p-2 sm:p-3">
        {autoPostList?.enabled ? (
          <AutoPostSocialGroupedList
            scenes={sceneList}
            groups={autoPostList.groups}
            onGroupsChange={autoPostList.onGroupsChange}
            renderSceneRow={(scene, index) => renderSceneRow(scene, index)}
          />
        ) : (
          <SortableCardGrid
            items={paginatedScenes}
            getItemId={getSceneId}
            onReorder={handleReorderScenes}
            renderItem={renderSceneRow}
            renderDragOverlay={renderSceneDragOverlay}
            keyPrefix={selectedHistoryId || "default"}
            gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
            useDragHandle
            getDragHandleId={getDragHandleId}
          />
        )}
      </div>

      {paginationEnabled && (
        <BatchScenePagination
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={BATCH_SCENE_PAGE_SIZE}
          totalCount={sceneList.length}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
