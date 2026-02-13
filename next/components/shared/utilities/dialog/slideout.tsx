import { RiCloseLine } from "react-icons/ri";
import { useDebounce } from "../../../../lib/hooks/useDebounce";
import { Button } from "../form";
import { Dialog, DialogProps } from "./dialog";

export interface SlideoutProps extends DialogProps {
  placement?: "left" | "right";
  hasCloseButton?: boolean;
}

export function Slideout({
  className = "",
  style = {},
  placement = "right",
  hasCloseButton = true,
  ...props
}: SlideoutProps) {
  const show = useDebounce(props.isOpen, 50, true);

  return (
    <Dialog
      wrapperClass={`fixed w-full mx-auto h-full top-0 z-100 flex flex-col overflow-hidden ${
        placement == "left" ? "item-start" : "items-end"
      }`}
      overlayClass="fixed w-full h-full top-0 left-auto pointer-events-none self-center"
      dialogClass={`${
        props.mobileSizeMode ? `m-auto bg-transparent` : "bg-white"
      } relative shadow-md h-full  ${className}`}
      width={props.mobileSizeMode ? `100%` : undefined}
      isOpen={props.isOpen}
      onClose={props.onClose}
      openAnimation={
        placement == "left"
          ? props.mobileSizeMode
            ? `animate-scale-in-left`
            : "animate-slide-in-left"
          : props.mobileSizeMode
          ? `animate-scale-in-right`
          : `animate-slide-in-right`
      }
      closeAnimation={
        placement == "left"
          ? props.mobileSizeMode
            ? `animate-scale-out-left`
            : "animate-slide-out-left"
          : props.mobileSizeMode
          ? `animate-scale-out-right`
          : `animate-slide-out-right`
      }
      slideFromBottom="none"
      {...props}
    >
      {hasCloseButton && (
        <Button
          hoverDanger
          className="absolute top-0 w-12 h-12 px-0 text-gray-500 bg-gray-200 rounded-none -left-12 rounded-bl-2xl"
          iconClassName="text-2xl"
          icon={<RiCloseLine />}
          onClick={() => {
            props.onClose();
          }}
        />
      )}
      {show && props.children}
    </Dialog>
  );
}
