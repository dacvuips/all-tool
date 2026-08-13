import { Children, MouseEventHandler, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HiOutlineX } from "react-icons/hi";
import { forceCheck } from "react-lazyload";
import { useDevice } from "../../../../lib/hooks/useDevice";
import { useScrollBlock } from "../../../../lib/hooks/useScrollBlock";
import { ErrorCatcher } from "../misc";

export interface DialogProps extends ReactProps {
  wrapperClass?: string;
  overlayClass?: string;
  dialogClass?: string;
  extraDialogClass?: string;
  extraDialogStyle?: React.CSSProperties;
  headerClass?: string;
  extraHeaderClass?: string;
  bodyClass?: string;
  extraBodyClass?: string;
  footerClass?: string;
  extraFooterClass?: string;
  title?: string;
  icon?: JSX.Element;
  width?: string | number;
  maxWidth?: string | number;
  minWidth?: string | number;
  mobileSizeMode?: boolean;
  slideFromBottom?: "none" | "mobile-only" | "all";
  openAnimation?: string;
  closeAnimation?: string;
  ref?: any;
  root?: string;
  isOpen?: boolean;
  hasCloseIcon?: boolean;
  onClose?: () => any;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onOverlayClick?: MouseEventHandler<HTMLDivElement>;
}

const ROOT_ID = "dialog-root";
export function Dialog({
  wrapperClass = "fixed w-full h-screen top-0 left-0 z-100 flex flex-col items-center overflow-y-scroll py-20 no-scrollbar",
  overlayClass = "fixed w-full h-full top-0",
  dialogClass = "relative bg-white shadow-md rounded-2xl m-auto",
  extraDialogClass = "",
  extraDialogStyle = {},
  headerClass = "relative flex px-5 py-1 box-content bg-slate-50 z-5 border-top rounded-t z-10",
  extraHeaderClass = "",
  bodyClass = "relative pl-5 pr-5 pb-5 bg-white rounded-2xl",
  extraBodyClass = "",
  footerClass = "relative flex px-4 py-2 bg-white z-5 rounded-b",
  extraFooterClass = "",
  slideFromBottom = "mobile-only",
  width = "auto",
  mobileSizeMode = false,
  maxWidth = "86vw",
  minWidth = undefined,
  title = "",
  icon = null,
  style = {},
  hasCloseIcon = true,
  onClick = () => {},
  onOverlayClick = () => props.onClose(),
  ...props
}: DialogProps) {
  const { isMobile, isSSR } = useDevice();
  if (isSSR) return null;

  const [isOpen, setIsOpen] = useState(props.isOpen);
  const wrapperRef = useRef<HTMLDivElement>();
  const dialogRef = useRef<HTMLDivElement>();

  useEffect(() => {
    let timeout;
    if (props.isOpen) {
      setIsOpen(props.isOpen);
      setTimeout(() => forceCheck(), 100);
    } else {
      timeout = setTimeout(() => {
        setIsOpen(props.isOpen);
      }, 100);
    }
    return () => clearTimeout(timeout);
  }, [props.isOpen]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (
        dialogRef.current &&
        !dialogRef.current.contains(event.target) &&
        wrapperRef.current &&
        wrapperRef.current.contains(event.target)
      ) {
        onOverlayClick(event);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dialogRef]);

  useScrollBlock({ rootId: ROOT_ID, dependencies: [isOpen] });

  let header = Children.map(props.children, (child) =>
    child?.type?.displayName === "Header" ? child : null
  );
  let body = Children.map(props.children, (child) =>
    child?.type?.displayName === "Body" ? child : null
  );
  let footer = Children.map(props.children, (child) =>
    child?.type?.displayName === "Footer" ? child : null
  );
  let children = Children.map(props.children, (child) =>
    !child?.type?.displayName ? child : null
  );

  if (title && !header?.length) {
    header = [
      <>
        <div className="flex items-center flex-1 h-10 min-w-0" style={{ justifyContent: "inherit" }}>
          {icon ? <i className="mr-2 text-lg text-primary shrink-0">{icon}</i> : null}
          <span className="text-sm font-semibold text-gray-600 uppercase truncate" title={title}>
            {title}
          </span>
        </div>
        {hasCloseIcon && (
          <button className="transform translate-x-5 btn-default" onClick={() => props.onClose()}>
            <i className="text-lg">
              <HiOutlineX />
            </i>
          </button>
        )}
      </>,
    ];
  }

  const isSlideFromBottom =
    (slideFromBottom == "mobile-only" && isMobile) || slideFromBottom == "all";

  let el = (
    <div
      className={`dialog-wrapper ${wrapperClass} ${isSlideFromBottom ? "bottom-mode" : ""} ${
        isMobile ? "mobile" : ""
      }`}
      style={{ ...style }}
      ref={wrapperRef}
    >
      <div
        className={`pointer-events-none ${overlayClass} ${
          props.isOpen ? "animate-emerge" : "animate-fade"
        } ${mobileSizeMode ? "max-w-md" : ""}`}
        style={{
          backgroundColor: "rgba(0,0,0,.32)",
        }}
      ></div>
      <div
        ref={dialogRef}
        className={`dialog ${dialogClass} h- ${extraDialogClass} ${
          props.isOpen
            ? props.openAnimation
              ? props.openAnimation
              : isSlideFromBottom
              ? "animate-slide-in-bottom"
              : "animate-scale-up"
            : props.closeAnimation
            ? props.closeAnimation
            : isSlideFromBottom
            ? "animate-slide-out-bottom"
            : "animate-scale-down"
        }  ${mobileSizeMode ? "max-w-lg" : ""}`}
        style={{
          width,
          maxWidth: mobileSizeMode || isSlideFromBottom ? undefined : maxWidth,
          minWidth: minWidth,
          ...extraDialogStyle,
        }}
        onClick={onClick}
      >
        {header?.length ? (
          <div className={`dialog-header ${headerClass} ${extraHeaderClass}`}>{header[0]}</div>
        ) : null}
        <ErrorCatcher>
          {body?.length ? (
            <div className={`dialog-body ${bodyClass} ${extraBodyClass}`}>{body[0]}</div>
          ) : null}
          {isOpen && children}
        </ErrorCatcher>
        {footer?.length ? (
          <div className={`dialog-footer ${footerClass} ${extraFooterClass}`}>{footer[0]}</div>
        ) : null}
      </div>
    </div>
  );

  return isOpen ? createPortal(el, document.getElementById(props.root || ROOT_ID)) : null;
}

const Header = ({ children }) => children;
Header.displayName = "Header";
Dialog.Header = Header;

const Body = ({ children }) => children;
Body.displayName = "Body";
Dialog.Body = Body;

const Footer = ({ children }) => children;
Footer.displayName = "Footer";
Dialog.Footer = Footer;
