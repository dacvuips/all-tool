/**
 * Layout sidebar trái + panel phải (responsive + kéo resize trên desktop)
 */
import { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { RiDragMove2Fill, RiMenuLine } from "react-icons/ri";
import { useResizableWidth } from "../../../../lib/hooks/useResizableWidth";
import { useScreen } from "../../../../lib/hooks/useScreen";

export const AFFILIATE_VIDEO_SIDEBAR_WIDTH_KEY = "affiliate-video-sidebar-width";

export type AffiliateVideoSidebarLayoutProps = {
  storageKey?: string;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  sidebar: ReactNode;
  children: ReactNode;
};

export function AffiliateVideoSidebarLayout({
  storageKey = AFFILIATE_VIDEO_SIDEBAR_WIDTH_KEY,
  isOpen,
  onOpenChange,
  sidebar,
  children,
}: AffiliateVideoSidebarLayoutProps) {
  const { t } = useTranslation();
  const isMd = useScreen("md");
  const {
    width: sidebarWidth,
    isResizing,
    onResizeStart,
  } = useResizableWidth({
    storageKey,
    defaultWidth: 320,
    minWidth: 260,
    maxWidth: 560,
    enabled: isMd === true,
  });

  return (
    <div className="flex overflow-hidden relative flex-1 min-w-0">
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className={`md:hidden fixed top-1/2 -translate-y-1/2 -left-0.5 z-100 w-7 h-14 text-white rounded-r-lg bg-primary shadow-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 hover:text-gray-800 transition-colors border ${
          isOpen ? "hidden" : ""
        }`}
        title={t("Mở cấu hình")}
      >
        <RiMenuLine className="text-xl" />
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden bg-black/40"
          onClick={() => onOpenChange(false)}
        />
      )}

      <div
        className={`
          flex-shrink-0 flex flex-col border-r border-gray-200 overflow-hidden md:overflow-visible bg-white
          md:relative md:translate-x-0
          transform fixed inset-y-0 left-0 z-50 w-80 pt-14 md:pt-0
          ${isResizing ? "" : "transition-transform duration-300"}
          ${isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}
        `}
        style={isMd === true ? { width: sidebarWidth } : undefined}
      >
        <div className="flex overflow-hidden flex-col flex-1 min-w-0 min-h-0">{sidebar}</div>
        {isMd && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label={t("Đổi kích thước sidebar")}
            title={t("Kéo để thay đổi kích thước")}
            onMouseDown={onResizeStart}
            className={`group absolute top-0 -right-1 z-10 flex h-full w-3 translate-x-1/2 cursor-col-resize touch-none items-center justify-center ${
              isResizing ? "bg-primary/10" : ""
            }`}
          >
            <div
              className={`pointer-events-none flex items-center justify-center px-1 py-2 transition-opacity duration-150 ${
                isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"
              }`}
            >
              <RiDragMove2Fill className="text-gray-500 text-28" />
            </div>
          </div>
        )}
      </div>

      <div className="flex overflow-hidden flex-col flex-1 min-w-0 h-full">{children}</div>
    </div>
  );
}
