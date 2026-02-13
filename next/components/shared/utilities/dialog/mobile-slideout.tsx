import { Dialog, DialogProps } from "./dialog";

export interface MobileSlideoutProps extends DialogProps {
  placement?: "left" | "right";
}
export function MobileSlideout({
  className = "",
  style = {},
  mobileSizeMode = true,
  placement = "right",
  width = "94%",
  maxWidth = "320px",
  ...props
}: MobileSlideoutProps) {
  return (
    <Dialog
      wrapperClass={`fixed w-full mx-auto h-full top-0 z-100 flex flex-col overflow-hidden ${
        placement == "left" ? "item-start" : "items-end"
      }`}
      overlayClass="fixed w-full h-full top-0 left-auto pointer-events-none self-center"
      dialogClass={`m-auto bg-transparent relative shadow-md h-full`}
      width="100%"
      isOpen={props.isOpen}
      onClose={props.onClose}
      openAnimation={placement == "left" ? "animate-scale-in-left" : `animate-scale-in-right`}
      closeAnimation={placement == "left" ? `animate-scale-out-left` : `animate-scale-out-right`}
      slideFromBottom="none"
      mobileSizeMode={mobileSizeMode}
      onClick={(e) => {
        if ((e.target as HTMLDivElement).classList.contains("dialog")) {
          props.onClose();
        }
      }}
      {...props}
    >
      <div className="h-full bg-white" style={{ width, maxWidth }}>
        {props.children}
      </div>
    </Dialog>
  );
}
