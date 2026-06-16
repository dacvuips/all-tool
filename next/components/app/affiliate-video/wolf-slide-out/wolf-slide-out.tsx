import dynamic from "next/dynamic";
import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiLoader4Line } from "react-icons/ri";

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

interface WolfSlideOutProps extends SlideoutProps {
  children?: ReactNode;
}

export function WolfSlideOut({ children, className = "", ...props }: WolfSlideOutProps) {
  return (
    <Slideout
      {...props}
      width="86vw"
      maxWidth="800px"
      placement="right"
      className={`!bg-white border-l border-slate-200  mt-14   ${className}`}
      hasCloseButton
      onOverlayClick={() => {}}
    >
      <div className="flex overflow-hidden flex-col h-full bg-white text-slate-700">
        {children ?? <WolfSlideOutPage />}
      </div>
    </Slideout>
  );
}

export function WolfSlideOutWidget() {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);

  const handleOpen = () => {
    setHasOpened(true);
    setIsOpen(true);
  };

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
