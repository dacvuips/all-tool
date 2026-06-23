/**
 * shared/batch-list-header.tsx
 * Header toolbar cho SharedBatchListPanel: lịch sử, action bar, tab/toàn cục
 */
import React from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import {
  MdFileDownload,
  MdFileDownloadOff,
  MdRecordVoiceOver,
  MdVoiceOverOff,
} from "react-icons/md";
import { RiImageFill, RiQuestionLine, RiText, RiVideoFill } from "react-icons/ri";
import { NoTextIcon } from "../../../../public/assets/svg/no-text-icon";
import { Button } from "../../../shared/utilities/form";
import { getAutoDownloadDefault } from "./autoDownloadUtils";
import { SceneTabKey } from "./scene-card-tabs";
import { BaseHistoryItem, SceneHistoryDropdown } from "./scene-history-dropdown";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

export type BatchListHeaderIntroStep = {
  element: string;
  title: string;
  intro: string;
  position: "top" | "right" | "bottom" | "left" | "auto";
};

/** Các bước hướng dẫn intro.js cho từng control trong header toolbar */
export function getBatchListHeaderIntroSteps(
  t: (key: string) => string,
  options?: { hasHistory?: boolean }
): BatchListHeaderIntroStep[] {
  const steps: BatchListHeaderIntroStep[] = [];

  if (options?.hasHistory) {
    steps.push(
      {
        element: "#batch-history-select",
        title: t("Chọn lịch sử"),
        intro: t(
          "Chọn lại bản phân tích đã lưu. Mỗi mục hiển thị thời gian và số cảnh tương ứng."
        ),
        position: "bottom",
      },
      {
        element: "#batch-history-clear",
        title: t("Xóa lịch sử"),
        intro: t("Xóa toàn bộ các bản phân tích đã lưu trong trình duyệt. Thao tác không thể hoàn tác."),
        position: "bottom",
      }
    );
  }

  steps.push(
    {
      element: "#batch-scene-count",
      title: t("Tổng số cảnh"),
      intro: t("Số lượng cảnh hiện có trong danh sách hàng loạt sau khi phân tích video."),
      position: "bottom",
    },
    {
      element: "#batch-global-tab-select",
      title: t("Tab xem toàn cục"),
      intro: t(
        "Chuyển nhanh tab Ảnh, Video hoặc Video nối trên tất cả thẻ cảnh cùng lúc thay vì từng thẻ một."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-download",
      title: t("Tải tự động"),
      intro: t(
        "Bật (xanh) để tự động tải file sau khi tạo ảnh/video xong. Tắt (xám) để không tải tự động — áp dụng cho tất cả cảnh."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-notext",
      title: t("Chữ overlay"),
      intro: t(
        "Bật (xanh) để cho phép hiển thị chữ/text trên ảnh và video. Tắt để ẩn chữ overlay trên tất cả cảnh."
      ),
      position: "bottom",
    },
    {
      element: "#batch-toggle-all-voice",
      title: t("Thoại / Voiceover"),
      intro: t(
        "Bật/tắt lời thoại (voiceover) cho tất cả cảnh. Tắt (đỏ) khi bạn chỉ cần video không có giọng nói."
      ),
      position: "bottom",
    }
  );

  return steps;
}

export interface BatchListHistoryConfig<TData = unknown> {
  items: BaseHistoryItem<TData>[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void | Promise<void>;
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
            <button
              type="button"
              id="batch-list-guide-btn"
              title={t("Hướng dẫn sử dụng")}
              aria-label={t("Hướng dẫn sử dụng")}
              onClick={onOpenIntro}
              className="hidden md:flex justify-center items-center w-5 h-5 rounded-full border-0 bg-blue-100 text-blue-600 cursor-pointer transition-colors hover:bg-blue-200"
            >
              <RiQuestionLine className="text-xs" />
            </button>
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
        <Button
          onClick={() => onToggleAllNoDownload()}
          className={`w-6 h-6 px-2 rounded-md shadow-sm ${
            allNoDownload
              ? "text-green-500 bg-green-50 hover:bg-green-100"
              : "text-gray-400 bg-white hover:text-green-500 hover:bg-green-50"
          }`}
          iconClassName="text-sm"
          icon={allNoDownload ? <MdFileDownload /> : <MdFileDownloadOff />}
          tooltip={
            allNoDownload
              ? t("Cho phép tải sau khi tạo ảnh/video xong")
              : t("Không cho phép tải sau khi tạo ảnh/video xong")
          }
          placement="bottom"
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
