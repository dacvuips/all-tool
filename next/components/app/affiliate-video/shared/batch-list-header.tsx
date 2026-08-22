/**
 * shared/batch-list-header.tsx
 * Header toolbar cho SharedBatchListPanel: lịch sử, action bar, tab/toàn cục
 */
import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import { HiChevronDown } from "react-icons/hi";
import {
  MdRecordVoiceOver,
  MdVoiceOverOff,
} from "react-icons/md";
import { RiImageFill, RiText, RiVideoFill } from "react-icons/ri";
import { NoTextIcon } from "../../../../public/assets/svg/no-text-icon";
import { Button } from "../../../shared/utilities/form";
import { FreeVoiceSelect } from "../../voice/free-voice-list";
import { AffiliateRightPanelGuideButton } from "./affiliate-right-panel-guide-button";
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
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

const GLOBAL_TAB_OPTIONS: {
  key: SceneTabKey;
  labelKey: string;
  icon: React.ReactNode;
  activeIconClass: string;
}[] = [
  {
    key: "image",
    labelKey: "Ảnh",
    icon: <RiImageFill className="w-3.5 h-3.5" />,
    activeIconClass: "text-pink-500",
  },
  {
    key: "video",
    labelKey: "Video",
    icon: <AiOutlineVideoCamera className="w-3.5 h-3.5" />,
    activeIconClass: "text-purple-500",
  },
  {
    key: "extend",
    labelKey: "Video nối",
    icon: <AiOutlineVideoCameraAdd className="w-3.5 h-3.5" />,
    activeIconClass: "text-primary",
  },
];

function BatchGlobalTabSelect({
  value,
  onChange,
}: {
  value: SceneTabKey | null;
  onChange: (tab: SceneTabKey | null) => void;
}) {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = GLOBAL_TAB_OPTIONS.find((opt) => opt.key === value);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} id="batch-global-tab-select" className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 py-1 pl-2 pr-1.5 text-xs font-semibold text-gray-600 bg-white rounded-lg border border-gray-200 shadow-sm transition-colors cursor-pointer outline-none hover:border-gray-300 focus:border-primary focus:ring-1 focus:ring-primary/30"
      >
        <span
          className={`inline-flex flex-shrink-0 ${
            selected ? selected.activeIconClass : "text-gray-400"
          }`}
        >
          {selected ? selected.icon : <RiVideoFill className="w-3.5 h-3.5" />}
        </span>
        <span className="whitespace-nowrap">
          {selected ? t(selected.labelKey) : t("Ảnh")}
        </span>
        <HiChevronDown
          className={`flex-shrink-0 w-3.5 h-3.5 text-gray-400 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[9.5rem] bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden py-1">
          {GLOBAL_TAB_OPTIONS.map((opt) => {
            const isSelected = value === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => {
                  onChange(opt.key);
                  setOpen(false);
                }}
                className={`w-full flex items-center whitespace-nowrap gap-2 px-2.5 py-1.5 text-left text-xs font-semibold border-0 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-gray-50 text-gray-800"
                    : "bg-transparent text-gray-600 hover:bg-gray-50"
                }`}
              >
                <span className={`inline-flex flex-shrink-0 ${opt.activeIconClass}`}>
                  {opt.icon}
                </span>
                <span>{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

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
  /** Mode Thành phần: hiện select giọng áp dụng cho tất cả phân cảnh */
  showBatchVideoVoice?: boolean;
  onSetAllVideoVoice?: (voiceId: string) => void;
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
  showBatchVideoVoice = false,
  onSetAllVideoVoice,
  ActionBarComponent,
  onOpenIntro,
}: BatchListHeaderProps) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();
  const defaultAutoDownload = getAutoDownloadDefault();
  const allNoText = scenes.every((s) => s.noText);
  const allNoDownload = scenes.every((s) => s.noDownload ?? defaultAutoDownload);
  const allVoiceDisabled = scenes.every((s) => s.voiceDisable);
  const sharedVideoVoice = (() => {
    if (!scenes.length) return "";
    const first = String(scenes[0]?.videoVoice || "").trim().toLowerCase();
    if (!first) return "";
    return scenes.every((s) => String(s?.videoVoice || "").trim().toLowerCase() === first)
      ? first
      : "";
  })();

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
          <BatchGlobalTabSelect value={globalTab} onChange={onGlobalTabChange} />
        </div>

        {showBatchVideoVoice && onSetAllVideoVoice ? (
          <div id="batch-set-all-video-voice" className="w-52 max-w-[14rem] shrink-0">
            <FreeVoiceSelect
              value={sharedVideoVoice}
              onChange={onSetAllVideoVoice}
              placeholder={t("Chọn giọng tất cả phân cảnh")}
              className="!min-w-0 !flex-none w-full"
            />
          </div>
        ) : null}

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
