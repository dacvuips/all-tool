/**
 * shared/batch-list.tsx
 * Shared Batch List Panel – danh sách scene dạng bảng
 * Dùng chung cho single, copy-video, trending
 * className only – Tailwind CSS, no inline styles
 */
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import { MdRecordVoiceOver, MdVoiceOverOff } from "react-icons/md";
import { RiImageFill, RiText, RiVideoFill } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { NoTextIcon } from "../../../../public/assets/svg/no-text-icon";
import { Button } from "../../../shared/utilities/form";
import { CharacterItem } from "../constants";
import { SceneTabKey } from "./scene-card-tabs";
import { BaseHistoryItem, SceneHistoryDropdown } from "./scene-history-dropdown";

/** Cấu hình dropdown lịch sử – data từ provider (IndexedDB) */
export interface BatchListHistoryConfig<TData = unknown> {
  items: BaseHistoryItem<TData>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void | Promise<void>;
  formatOptionLabel?: (item: BaseHistoryItem<TData>) => string;
}

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
    imageUrls: string[]
  ) => {
    const updated = sceneList.map((s) =>
      s.id === sceneId ? { ...s, elementImageSlots: slots, selectedProductImages: imageUrls } : s
    );
    setSceneList(updated);
    try {
      await onPersistScenes(updated);
    } catch (err) {
      console.error("[handleUpdateElementImageSlots] Failed to persist:", err);
    }
  };

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
    <div className="flex overflow-hidden flex-col h-full">
      {history && (
        <div className="px-3 pt-3 bg-white shrink-0">
          <SceneHistoryDropdown
            items={history.items}
            selectedId={history.selectedId}
            onSelect={history.onSelect}
            onClear={history.onClear}
            formatOptionLabel={history.formatOptionLabel}
          />
        </div>
      )}

      {/* Action buttons bar */}
      <ActionBarComponent scenes={sceneList} />

      {/* ── Sticky global toggle bar ── */}
      <div className="flex sticky top-0 z-20 gap-3 items-center px-3 py-2 bg-gray-50 border-b border-gray-200">
        {/* Scene count label */}
        <div className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide">
          <RiVideoFill className="text-sm text-teal-500" />
          {sceneList.length} {t("Cảnh")}
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* ── Global tab selector ── */}
        <div className="flex gap-1 items-center">
          <div className="relative">
            <select
              value={globalTab || ""}
              onChange={(e) => setGlobalTab((e.target.value as SceneTabKey) || null)}
              className="py-1 pr-5 pl-6 text-xs font-semibold text-gray-600 bg-white rounded-lg border border-gray-200 shadow-sm transition-colors appearance-none cursor-pointer outline-none hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              <option value="image">{t("Ảnh")}</option>
              <option value="video">{t("Video")}</option>
              <option value="extend">{t("Video nối")}</option>
            </select>
            {/* icon tương ứng với lựa chọn hiện tại */}
            <span className="absolute left-1.5 top-2 -translate-y-1/2 pointer-events-none flex items-center">
              {globalTab === "image" && <RiImageFill className="w-3 h-3 text-pink-500" />}
              {globalTab === "video" && (
                <AiOutlineVideoCamera className="w-3 h-3 text-purple-500" />
              )}
              {globalTab === "extend" && (
                <AiOutlineVideoCameraAdd className="w-3 h-3 text-primary" />
              )}
              {!globalTab && <RiVideoFill className="w-3 h-3 text-gray-400" />}
            </span>
          </div>
        </div>

        {/* Toggle all NoText */}
        <Button
          onClick={handleToggleAllNoText}
          className={`w-7 h-7 rounded-lg shadow-sm ${
            sceneList.every((s) => s.noText)
              ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 bg-white hover:text-blue-500 hover:bg-blue-50"
          }`}
          iconClassName="text-sm"
          icon={sceneList.every((s) => s.noText) ? <RiText /> : <NoTextIcon />}
          tooltip={
            sceneList.every((s) => s.noText)
              ? t("Đang cho phép hiển thị 'Chữ' trong tất cả")
              : t("Không cho phép hiển thị 'Chữ' trong tất cả")
          }
          placement="bottom"
        />

        {/* Toggle all VoiceDisable */}
        <Button
          onClick={handleToggleAllVoiceDisable}
          className={`w-7 h-7 rounded-lg shadow-sm ${
            sceneList.every((s) => s.voiceDisable)
              ? "text-red-500 bg-red-50 hover:bg-red-100"
              : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
          }`}
          iconClassName="text-sm"
          icon={sceneList.every((s) => s.voiceDisable) ? <MdVoiceOverOff /> : <MdRecordVoiceOver />}
          tooltip={
            sceneList.every((s) => s.voiceDisable) ? t("Bật thoại tất cả") : t("Tắt thoại tất cả")
          }
          placement="bottom"
        />
      </div>

      {/* ── Scrollable card grid – responsive columns ── */}
      <div className="overflow-auto flex-1 p-2 v-scrollbar sm:p-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6">
          {sceneList.map((scene, index) => (
            <SceneRowComponent
              key={`${selectedHistoryId || "default"}-${scene.id}`}
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
              onUpdateSelectedProductImages={handleUpdateSelectedProductImages}
              onUpdateElementImageSlots={handleUpdateElementImageSlots}
              forcedTab={globalTab}
              {...sceneRowExtraProps}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
