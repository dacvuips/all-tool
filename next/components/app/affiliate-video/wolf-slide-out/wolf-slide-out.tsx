import dynamic from "next/dynamic";
import { ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDragMove2Fill, RiLoader4Line } from "react-icons/ri";

import { useResizableWidth } from "../../../../lib/hooks/useResizableWidth";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { SubscriptionPlanEnum } from "../../../../lib/repo";
import { Slideout, SlideoutProps } from "../../../shared/utilities/dialog/slideout";
import { Img } from "../../../shared/utilities/misc";

const WolfSlideOutPage = dynamic(
  () => import("./wolf-side-out-page").then((mod) => ({ default: mod.WolfSlideOutPage })),
  {
    loading: () => (
      <div className="flex flex-1 justify-center items-center h-full min-h-[200px]">
        <RiLoader4Line className="text-2xl animate-spin text-slate-400" />
      </div>
    ),
    ssr: false,
  }
);

const WOLF_TRIGGER_IMAGE = "/assets/img/logo-small-1.png";

export const WOLF_SLIDEOUT_WIDTH_KEY = "wolf-slideout-width";
const WOLF_SLIDEOUT_DEFAULT_WIDTH = 800;
const WOLF_SLIDEOUT_MIN_WIDTH = 360;
const WOLF_SLIDEOUT_MAX_WIDTH = 1200;

interface WolfSlideOutProps extends SlideoutProps {
  children?: ReactNode;
  /** Chiều rộng mặc định khi mở (px) */
  defaultWidth?: number;
  /** Chiều rộng tối thiểu (px) */
  minPanelWidth?: number;
  /** Chiều rộng tối đa (px) */
  maxPanelWidth?: number;
  /** localStorage key để nhớ kích thước panel */
  widthStorageKey?: string;
}

export function WolfSlideOut({
  children,
  className = "",
  defaultWidth = WOLF_SLIDEOUT_DEFAULT_WIDTH,
  minPanelWidth = WOLF_SLIDEOUT_MIN_WIDTH,
  maxPanelWidth = WOLF_SLIDEOUT_MAX_WIDTH,
  widthStorageKey = WOLF_SLIDEOUT_WIDTH_KEY,
  isOpen,
  ...props
}: WolfSlideOutProps) {
  const { customer } = useAuth();
  const { t } = useTranslation();
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 767px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  const {
    width: panelWidth,
    isResizing,
    onResizeStart,
  } = useResizableWidth({
    storageKey: widthStorageKey,
    defaultWidth,
    minWidth: minPanelWidth,
    maxWidth: maxPanelWidth,
    edge: "right",
    enabled: isOpen && !isMobile,
  });

  if (
    customer?.googlePackage?.subscription === SubscriptionPlanEnum.FREE ||
    !customer?.googlePackage
  ) {
    return null;
  }
  return (
    <Slideout
      {...props}
      isOpen={isOpen}
      width={isMobile ? "80%" : panelWidth}
      minWidth={isMobile ? undefined : minPanelWidth}
      maxWidth={isMobile ? undefined : maxPanelWidth}
      placement="right"
      className={`!bg-white border-l border-slate-200 mt-14 ${
        isResizing ? "" : "transition-[width] duration-150"
      } ${className}`}
      hasCloseButton
      onOverlayClick={() => {}}
    >
      <div className="relative flex overflow-hidden flex-col h-full bg-white text-slate-700">
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label={t("Đổi kích thước panel Wolf")}
          title={t("Kéo để thay đổi chiều rộng")}
          onMouseDown={onResizeStart}
          className={`group absolute top-0 left-0 z-20 hidden h-full w-3 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center md:flex ${
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
        {children ?? <WolfSlideOutPage />}
      </div>
    </Slideout>
  );
}

export function WolfSlideOutWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const { customer } = useAuth();
  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };
  if (
    customer?.googlePackage?.subscription === SubscriptionPlanEnum.FREE ||
    !customer?.googlePackage
  ) {
    return null;
  }
  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        title={t("Mở trợ lý Wolf")}
        className={`fixed top-1/2 -translate-y-1/2 -right-0.5 z-50 flex h-14 w-8 items-center justify-center overflow-hidden rounded-l-lg border bg-white shadow-lg opacity-50 transition-all cursor-pointer hover:opacity-100 hover:shadow-xl ${
          isOpen ? "hidden" : ""
        }`}
      >
        <Img src={WOLF_TRIGGER_IMAGE} alt="wolf" className="object-contain w-10 h-6" />
      </button>

      {hasOpened && <WolfSlideOut isOpen={isOpen} onClose={() => setIsOpen(false)} />}
    </>
  );
}
