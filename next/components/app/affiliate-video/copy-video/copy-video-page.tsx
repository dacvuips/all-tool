/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiMenuLine } from "react-icons/ri";
import { TAB_TYPE } from "../constants";
import { AffiliateVideoRightPanel } from "../single/right-panel/affiliate-video-right-panel";
import { TextToVideoTab } from "../single/sibar/text-to-video-tab";

interface AffiliateSingleBodyProps {
  type: TAB_TYPE;
}

export const AffiliateSingleBody = ({ type }: AffiliateSingleBodyProps) => {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex flex-1 overflow-hidden relative">
      {/* ══ NÚT MỞ SIDEBAR (chỉ hiện trên mobile) ══ */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="md:hidden fixed bottom-16 left-4 z-50 w-12 h-12 rounded-full bg-red-500 text-white shadow-lg flex items-center justify-center cursor-pointer border-0 hover:bg-red-600 transition-colors"
        title={t("Mở cấu hình")}
      >
        <RiMenuLine className="text-xl" />
      </button>

      {/* ══ OVERLAY (mobile) ══ */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* ══ LEFT SIDEBAR ══ */}
      <div
        className={`
          flex-shrink-0 flex flex-col border-r border-gray-200 overflow-hidden bg-white
          md:relative md:w-80 md:translate-x-0
          transform fixed inset-y-0 left-0 z-50 w-80 transition-transform duration-300
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
      >
        <TextToVideoTab onClose={() => setIsSidebarOpen(false)} type={type} />
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <AffiliateVideoRightPanel />
    </div>
  );
};
