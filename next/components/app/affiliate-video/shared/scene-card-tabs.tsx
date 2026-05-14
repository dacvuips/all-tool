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
import { RiImageFill } from "react-icons/ri";

// ── Tab definitions ──────────────────────────────────────────────────────────
export type SceneTabKey = "image" | "video" | "extend" | "high-quality";

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
    inactiveClass: "text-gray-500 hover:text-teal-500 hover:bg-teal-50",
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
      <div className="flex items-center  px-2 py-1.5 bg-gray-50 border-t border-gray-100 rounded-b-none">
        {visibleTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1 px-1 py-1 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer border-0 whitespace-nowrap ${
              currentTab === tab.key ? tab.activeClass : tab.inactiveClass
            }`}
          >
            {tab.icon}
            <span className="hidden sm:inline">{t(tab.labelKey)}</span>
          </button>
        ))}
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
