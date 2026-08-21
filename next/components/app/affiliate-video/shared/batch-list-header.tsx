/**
 * shared/batch-list-header.tsx
 * Header toolbar cho SharedBatchListPanel: lịch sử, action bar, tab/toàn cục
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import {
  MdRecordVoiceOver,
  MdVoiceOverOff,
} from "react-icons/md";
import { RiImageFill, RiText, RiVideoFill } from "react-icons/ri";
import { NoTextIcon } from "../../../../public/assets/svg/no-text-icon";
import { Button } from "../../../shared/utilities/form";
import { AutoDownloadSettingsButton } from "./auto-download-settings-button";
import {
  getAutoDownloadDefault,
  getAutoDownloadImageResolutionDefault,
  getAutoDownloadVideoResolutionDefault,
  type AutoDownloadImageResolution,
  type VideoDownloadResolution,
} from "./autoDownloadUtils";
import { SceneTabKey } from "./scene-card-tabs";
import { BaseHistoryItem, SceneHistoryDropdown } from "./scene-history-dropdown";
import { AffiliateRightPanelGuideButton } from "./affiliate-right-panel-guide-button";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

export interface BatchListHistoryConfig<TData = unknown> {
  items: BaseHistoryItem<TData>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void | Promise<void>;
  onRename?: (id: string, label: string) => void | Promise<void>;
  formatOptionLabel?: (item: BaseHistoryItem<TData>) => string;
}

export interface BatchListHeaderProps {
  scenes: any[];
  history?: BatchListHistoryConfig;
  globalTab: SceneTabKey | null;
  onGlobalTabChange: (tab: SceneTabKey | null) => void;
  onToggleAllNoText: () => void;
  onToggleAllVoiceDisable: () => void;
  onToggleAllNoDownload: () => void;
  onSetAllAutoDownloadImageResolution: (resolution: AutoDownloadImageResolution) => void;
  onSetAllAutoDownloadVideoResolution: (resolution: VideoDownloadResolution) => void;
  ActionBarComponent: React.ComponentType<{ scenes: any[] }>;
  onOpenIntro?: () => void;
}

export function BatchListHeader({
  scenes,
  history,
  globalTab,
  onGlobalTabChange,
  onToggleAllNoText,
  onToggleAllVoiceDisable,
  onToggleAllNoDownload,
  onSetAllAutoDownloadImageResolution,
  onSetAllAutoDownloadVideoResolution,
  ActionBarComponent,
  onOpenIntro,
}: BatchListHeaderProps) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();
  const defaultAutoDownload = getAutoDownloadDefault();
  const allNoText = scenes.every((s) => s.noText);
  const allNoDownload = scenes.every((s) => s.noDownload ?? defaultAutoDownload);
  const allVoiceDisabled = scenes.every((s) => s.voiceDisable);

  return (
    <>
      {history && (
        <div id="batch-scene-history" className="px-3 pt-3 bg-white shrink-0">
          <SceneHistoryDropdown
            items={history.items}
            selectedId={history.selectedId}
            onSelect={history.onSelect}
            onClear={history.onClear}
            onRename={history.onRename}
            formatOptionLabel={history.formatOptionLabel}
          />
        </div>
      )}

      <ActionBarComponent scenes={scenes} />

      <div id="batch-scene-toolbar" className="flex sticky top-0 z-20 gap-3 items-center px-3 py-1 bg-gray-50 border-b border-gray-200">
        <div
          id="batch-scene-count"
          className="flex items-center gap-1.5 text-xs font-bold text-gray-500 uppercase tracking-wide"
        >
          <RiVideoFill className="text-sm text-teal-500" />
          {scenes.length} {t("Cảnh")}
          {onOpenIntro && introEnabled && (
            <AffiliateRightPanelGuideButton id="batch-list-guide-btn" onClick={onOpenIntro} />
          )}
        </div>

        <div className="flex-1" />

        <div className="flex gap-1 items-center">
          <div id="batch-global-tab-select" className="relative">
            <select
              value={globalTab || ""}
              onChange={(e) => onGlobalTabChange((e.target.value as SceneTabKey) || null)}
              className="py-1 pr-5 pl-6 text-xs font-semibold text-gray-600 bg-white rounded-lg border border-gray-200 shadow-sm transition-colors appearance-none cursor-pointer outline-none hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/30"
            >
              <option value="image">{t("Ảnh")}</option>
              <option value="video">{t("Video")}</option>
              <option value="extend">{t("Video nối")}</option>
            </select>
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
        <div id="batch-toggle-all-download">
          <AutoDownloadSettingsButton
            enabled={allNoDownload}
            onToggle={() => onToggleAllNoDownload()}
            imageResolution={getAutoDownloadImageResolutionDefault()}
            videoResolution={getAutoDownloadVideoResolutionDefault()}
            onImageResolutionChange={onSetAllAutoDownloadImageResolution}
            onVideoResolutionChange={onSetAllAutoDownloadVideoResolution}
          />
        </div>

        <div id="batch-toggle-all-notext">
        <Button
          onClick={onToggleAllNoText}
          className={`w-7 h-7 rounded-lg shadow-sm ${
            allNoText
              ? "text-blue-500 bg-blue-50 hover:bg-blue-100"
              : "text-gray-400 bg-white hover:text-blue-500 hover:bg-blue-50"
          }`}
          iconClassName="text-sm"
          icon={allNoText ? <RiText /> : <NoTextIcon />}
          tooltip={
            allNoText
              ? t("Đang cho phép hiển thị 'Chữ' trong tất cả")
              : t("Không cho phép hiển thị 'Chữ' trong tất cả")
          }
          placement="bottom"
        />
        </div>

        <div id="batch-toggle-all-voice">
        <Button
          onClick={onToggleAllVoiceDisable}
          className={`w-7 h-7 rounded-lg shadow-sm ${
            allVoiceDisabled
              ? "text-red-500 bg-red-50 hover:bg-red-100"
              : "text-gray-400 bg-white hover:text-red-500 hover:bg-red-50"
          }`}
          iconClassName="text-sm"
          icon={allVoiceDisabled ? <MdVoiceOverOff /> : <MdRecordVoiceOver />}
          tooltip={allVoiceDisabled ? t("Bật thoại tất cả") : t("Tắt thoại tất cả")}
          placement="bottom"
        />
        </div>
      </div>
    </>
  );
}
