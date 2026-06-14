import { ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

import { Slideout, SlideoutProps } from "../../../shared/utilities/dialog/slideout";
import { Img } from "../../../shared/utilities/misc";
import { WolfSlideOutPage } from "./wolf-side-out-page";

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

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        title={t("Mở trợ lý Wolf")}
        className={`fixed top-1/2 -translate-y-1/2 -right-0.5 z-50 flex h-14 w-12 items-center justify-center overflow-hidden rounded-l-lg border bg-white shadow-lg transition-shadow cursor-pointer hover:shadow-xl ${
          isOpen ? "hidden" : ""
        }`}
      >
        <Img src={WOLF_TRIGGER_IMAGE} alt="wolf" className="object-contain w-10 h-10" />
      </button>

      <WolfSlideOut isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
