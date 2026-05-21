/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiMenuLine } from "react-icons/ri";
import { ElementProvider } from "./providers/element-provider";
import { ElementRightPanel } from "./right-panel/element-right-panel";
import { ElementForm } from "./sibar/elementForm";

interface ElementProps {}

export const ElementPage = ({}: ElementProps) => {
  const { t } = useTranslation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ElementProvider>
      <div className="flex overflow-hidden relative flex-1">
        {/* ══ NÚT MỞ SIDEBAR (chỉ hiện trên mobile) ══ */}
        <button
          onClick={() => setIsSidebarOpen(true)}
          className={`md:hidden fixed top-1/2 -translate-y-1/2 -left-0.5 z-100 w-7 h-14 text-white rounded-r-lg bg-primary shadow-lg flex items-center justify-center cursor-pointer   hover:bg-gray-200 hover:text-gray-800 transition-colors border ${
            isSidebarOpen ? "hidden" : ""
          }`}
          title={t("Mở cấu hình")}
        >
          <RiMenuLine className="text-xl" />
        </button>

        {/* ══ OVERLAY (mobile) ══ */}
        {isSidebarOpen && (
          <div
            className="fixed inset-0 z-40 md:hidden bg-black/40"
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* ══ LEFT SIDEBAR ══ */}
        <div
          className={`
          flex-shrink-0 flex flex-col border-r border-gray-200 overflow-hidden bg-white
          md:relative md:w-80 md:translate-x-0
          transform fixed inset-y-0 left-0 z-50 w-80 pt-14 md:pt-0 transition-transform duration-300
          ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        >
          <ElementForm onClose={() => setIsSidebarOpen(false)} />
        </div>

        {/* ══ RIGHT PA NEL ══ */}
        <ElementRightPanel />
      </div>
    </ElementProvider>
  );
};
