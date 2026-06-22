/**
 * shared/batch-list.tsx
 * Shared Batch List Panel – danh sách scene dạng bảng
 * Dùng chung cho single, copy-video, trending
 * className only – Tailwind CSS, no inline styles
 */
import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiVideoFill } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { reorderScenesWithNumbers, SortableCardGrid } from "../../../shared/utilities/sortable";
import { CharacterItem } from "../constants";
import { ActionImageEnum } from "../elements/constants";
import { BatchListHeader, type BatchListHistoryConfig } from "./batch-list-header";
import { getAutoDownloadDefault, setAutoDownloadDefault } from "./autoDownloadUtils";
import { SceneTabKey } from "./scene-card-tabs";

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
}: SharedBatchListPanelProps) {
  const { t } = useTranslation();
  const [sceneList, setSceneList] = useState<any[]>(scenes);
  const [globalTab, setGlobalTab] = useState<SceneTabKey | null>(null);
  const { customer } = useAuth();
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

  /** Update element image slots (3 ô ảnh tham chiếu) + derived product image URLs */
  const handleUpdateElementImageSlots = async (
    sceneId: string,
    slots: any[],
    imageUrls: string[],
    actionMode?: ActionImageEnum
  ) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId
        ? {
            ...s,
            elementImageSlots: slots,
            selectedProductImages: imageUrls,
            elementImageSlotsActionMode: actionMode ?? s.elementImageSlotsActionMode,
          }
        : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleUpdateElementImageSlots] Failed to persist:", err);
    }
  };

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

  /** Kéo-thả đổi thứ tự – UI ngay, IndexedDB nền (không chặn thả) */
  const handleReorderScenes = useCallback(
    (reordered: any[]) => {
      const updated = reorderScenesWithNumbers(reordered);
      setSceneList(updated);
      void Promise.resolve(onSyncScenes(updated)).catch((err) =>
        console.error("[handleReorderScenes] Failed to persist:", err)
      );
    },
    [onSyncScenes]
  );

  const getSceneId = useCallback((scene: { id: string }) => scene.id, []);

  const renderSceneRow = useCallback(
    (scene: any, index: number) => (
      <SceneRowComponent
        scene={scene}
        index={index}
        nextSceneId={index < sceneList.length - 1 ? sceneList[index + 1].id : undefined}
        isDisabled={!!scene.disabled}
        characters={characters}
        hideImageColumn={hideImageColumn}
        onInsert={handleInsert}
        onUpdateScene={handleUpdateScene}
        onToggleDisable={handleToggleDisable}
        onToggleVoiceDisable={handleToggleVoiceDisable}
        onToggleNoText={handleToggleNoText}
        onToggleNoDownload={handleToggleNoDownload}
        onUpdateSelectedProductImages={handleUpdateSelectedProductImages}
        onUpdateElementImageSlots={handleUpdateElementImageSlots}
        onUpdateReviewImageSlots={handleUpdateReviewImageSlots}
        onUpdateElementVideoSlots={handleUpdateElementVideoSlots}
        forcedTab={globalTab}
        {...sceneRowExtraProps}
      />
    ),
    [
      sceneList.length,
      characters,
      hideImageColumn,
      globalTab,
      sceneRowExtraProps,
      handleInsert,
      handleUpdateScene,
      handleToggleDisable,
      handleToggleVoiceDisable,
      handleToggleNoText,
      handleToggleNoDownload,
      handleUpdateSelectedProductImages,
      handleUpdateElementImageSlots,
      handleUpdateReviewImageSlots,
      handleUpdateElementVideoSlots,
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
      />

      {/* ── Scrollable card grid – kéo thả đổi thứ tự scene ── */}
      <div className="flex-1 p-2 sm:p-3">
        <SortableCardGrid
          items={sceneList}
          getItemId={getSceneId}
          onReorder={handleReorderScenes}
          renderItem={renderSceneRow}
          renderDragOverlay={renderSceneDragOverlay}
          keyPrefix={selectedHistoryId || "default"}
          gridClassName="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6"
          useDragHandle
        />
      </div>
    </div>
  );
}
