/**
 * scene-card-tabs.tsx
 * Component tab bar dùng chung cho Scene Card
 * Hiển thị 3 tab: Hình ảnh, Video đơn, Video nối
 * Tab state lưu per-scene (mỗi card quản lý tab riêng)
 * className only – Tailwind CSS, no arbitrary values
 */
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineVideoCamera, AiOutlineVideoCameraAdd } from "react-icons/ai";
import { RiImageFill, RiLoader4Line } from "react-icons/ri";

// ── Tab definitions ──────────────────────────────────────────────────────────
export type SceneTabKey = "image" | "video" | "extend" | "high-quality";

/** Trạng thái loading/done cho mỗi tab */
export interface TabStatus {
  /** Đang generate */
  loading?: boolean;
  /** Giá trị progress 0–100 (hiển thị khi loading) */
  progress?: number;
  /** Đã có media (ảnh / video) → hiển thị dấu tích xanh */
  done?: boolean;
}

interface TabDef {
  key: SceneTabKey;
  icon: React.ReactNode;
  labelKey: string;
  /** Tailwind color classes khi active */
  activeClass: string;
  /** Tailwind color classes khi inactive */
  inactiveClass: string;
}

const TABS: TabDef[] = [
  {
    key: "image",
    icon: <RiImageFill className="text-sm" />,
    labelKey: "Ảnh",
    activeClass: "bg-pink-500 text-white shadow-sm",
    inactiveClass: "text-gray-500 hover:text-pink-500 hover:bg-pink-50",
  },
  {
    key: "video",
    icon: <AiOutlineVideoCamera className="text-sm" />,
    labelKey: "Video",
    activeClass: "bg-purple-500 text-white shadow-sm",
    inactiveClass: "text-gray-500 hover:text-purple-500 hover:bg-purple-50",
  },
  {
    key: "extend",
    icon: <AiOutlineVideoCameraAdd className="text-sm" />,
    labelKey: "Video nối",
    activeClass: "bg-primary text-white shadow-sm",
    inactiveClass: "text-gray-500 hover:text-primary hover:bg-primary-light ",
  },
];

// ── Props ────────────────────────────────────────────────────────────────────
export interface SceneCardTabsProps {
  /** Ẩn tab Hình ảnh (prompt_to_video mode) */
  hideImageTab?: boolean;
  /** Ẩn tab Video nối (không có nextSceneId) */
  hideExtendTab?: boolean;
  /** Nội dung render cho mỗi tab */
  renderImageTab: () => React.ReactNode;
  renderVideoTab: () => React.ReactNode;
  renderExtendTab: () => React.ReactNode;
  /** Prompt nằm trong tab Image (hiển thị sau media) */
  renderImagePrompt?: () => React.ReactNode;
  /** Prompt nằm trong tab Video & Video nối (hiển thị sau media) */
  renderVideoPrompts?: () => React.ReactNode;
  /** Trạng thái loading/done hiển thị lên nút tab */
  tabStatus?: Partial<Record<SceneTabKey, TabStatus>>;
}

// ── Component ────────────────────────────────────────────────────────────────

export function SceneCardTabs({
  hideImageTab = false,
  hideExtendTab = false,
  renderImageTab,
  renderVideoTab,
  renderExtendTab,
  renderImagePrompt,
  renderVideoPrompts,
  tabStatus,
}: SceneCardTabsProps) {
  const { t } = useTranslation();

  // Lọc tabs dựa trên điều kiện hiển thị
  const visibleTabs = TABS.filter((tab) => {
    if (tab.key === "image" && hideImageTab) return false;
    if (tab.key === "extend" && hideExtendTab) return false;
    return true;
  });

  // Default tab: image nếu có, nếu không thì video
  const defaultTab = visibleTabs[0]?.key || "video";
  const [activeTab, setActiveTab] = useState<SceneTabKey>(defaultTab);

  // Nếu active tab bị ẩn, chuyển về tab đầu tiên
  const currentTab = visibleTabs.find((t) => t.key === activeTab) ? activeTab : defaultTab;

  return (
    <div className="flex flex-col">
      {/* ── Tab bar ── */}
      <div className="flex items-center px-2 py-1.5 bg-gray-50 border-t border-gray-100 rounded-b-none justify-center gap-0.5">
        {visibleTabs.map((tab) => {
          const status = tabStatus?.[tab.key];
          const isLoading = !!status?.loading;
          const isDone = !isLoading && !!status?.done;
          const progress = status?.progress;
          const isActive = currentTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`relative flex items-center gap-1 px-1 py-1 w-full justify-center rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border-0 whitespace-nowrap ${
                isActive ? tab.activeClass : tab.inactiveClass
              }`}
            >
              {/* Icon / Spinner */}
              {isLoading ? <RiLoader4Line className="text-sm animate-spin" /> : tab.icon}

              <span>{t(tab.labelKey)}</span>

              {/* Progress label khi loading */}
              {isLoading && progress != null && (
                <span className="text-[10px] font-bold opacity-90 leading-none">
                  {Math.round(progress)}%
                </span>
              )}

              {/* Dấu tích xanh khi done – góc trên phải */}
              {isDone && (
                <span
                  data-tooltip="Hoàn thành"
                  data-placement="top"
                  className="absolute -top-1 -right-0.5 flex items-center justify-center border-dashed border w-4 h-4 rounded-full bg-white text-success shadow-sm"
                  style={{ fontSize: 9, lineHeight: 1 }}
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="p-2 sm:p-3">
        {currentTab === "image" && !hideImageTab && (
          <>
            {renderImageTab()}
            {renderImagePrompt && <div className="mt-2">{renderImagePrompt()}</div>}
          </>
        )}
        {currentTab === "video" && (
          <>
            {renderVideoTab()}
            {renderVideoPrompts && <div className="mt-2">{renderVideoPrompts()}</div>}
          </>
        )}
        {currentTab === "extend" && !hideExtendTab && (
          <>
            {renderExtendTab()}
            {renderVideoPrompts && <div className="mt-2">{renderVideoPrompts()}</div>}
          </>
        )}
      </div>
    </div>
  );
}
