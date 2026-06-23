import Link from "next/link";
import { MouseEvent, MutableRefObject, useEffect, useRef, useState } from "react";
import { CgSpinner } from "react-icons/cg";
import { Placement } from "tippy.js";
import { UrlObject } from "url";

export interface LinkProps {
  targetBlank?: boolean;
  rel?: string;
  download?: boolean;
  href?: string | UrlObject;
  toggleTargetBlank?: boolean;
}
export interface ButtonProps extends ReactProps, LinkProps {
  small?: boolean;
  medium?: boolean;
  large?: boolean;
  outline?: boolean;
  gray?: boolean;
  primary?: boolean;
  accent?: boolean;
  info?: boolean;
  success?: boolean;
  danger?: boolean;
  warning?: boolean;
  hoverDarken?: boolean;
  hoverAccent?: boolean;
  hoverInfo?: boolean;
  hoverWarning?: boolean;
  hoverSuccess?: boolean;
  hoverDanger?: boolean;
  hoverWhite?: boolean;
  textPrimary?: boolean;
  textAccent?: boolean;
  textInfo?: boolean;
  textWarning?: boolean;
  textSuccess?: boolean;
  textDanger?: boolean;
  disabled?: boolean;
  submit?: boolean;
  reset?: boolean;
  autoFocus?: boolean;
  unfocusable?: boolean;
  href?: string | UrlObject;
  targetBlank?: boolean;
  icon?: JSX.Element;
  iconClassName?: string;
  iconPosition?: "start" | "end";
  text?: JSX.Element | string;
  id?: string;
  tooltip?: string;
  placement?: Placement;
  isLoading?: boolean;
  asyncLoading?: boolean;
  stopPropagation?: boolean;
  preventDefault?: boolean;
  innerRef?: MutableRefObject<HTMLAnchorElement | HTMLButtonElement>;
  onClick?: (e?: MouseEvent) => any;
  onFileClick?: (files: FileList) => any;
}
export function Button({
  className = "",
  style,
  asyncLoading = true,
  iconClassName = "",
  iconPosition = "start",
  ...props
}: ButtonProps) {
  const [loading, setLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>();
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setLoading(props.isLoading);
  }, [props.isLoading]);

  let buttonClass = "";
  if (props.outline) {
    buttonClass = "btn-outline";
    if (props.primary) buttonClass += " is-primary";
    else if (props.accent) buttonClass += " is-accent";
    else if (props.info) buttonClass += " is-info";
    else if (props.success) buttonClass += " is-success";
    else if (props.danger) buttonClass += " is-danger";
    else if (props.warning) buttonClass += " is-warning";
  } else {
    if (props.primary) buttonClass = "btn-primary";
    else if (props.accent) buttonClass = "btn-accent";
    else if (props.gray) buttonClass = "btn-gray";
    else if (props.info) buttonClass = "btn-info";
    else if (props.success) buttonClass = "btn-success";
    else if (props.danger) buttonClass = "btn-danger";
    else if (props.warning) buttonClass = "btn-warning";
    else buttonClass = "btn-default";
  }

  let buttonHover = "";
  if (props.hoverDarken) buttonHover = "hover-darken";
  else if (props.hoverDanger) buttonHover = "hover-danger";
  else if (props.hoverAccent) buttonHover = "hover-accent";
  else if (props.hoverInfo) buttonHover = "hover-info";
  else if (props.hoverSuccess) buttonHover = "hover-success";
  else if (props.hoverWarning) buttonHover = "hover-warning";
  else if (props.hoverWhite) buttonHover = "hover-white";

  let buttonText = "";
  if (props.textPrimary) buttonText = "is-primary";
  else if (props.textDanger) buttonText = "is-danger";
  else if (props.textAccent) buttonText = "is-accent";
  else if (props.textInfo) buttonText = "is-info";
  else if (props.textSuccess) buttonText = "is-success";
  else if (props.textWarning) buttonText = "is-warning";

  let buttonSize = "";
  if (props.large) buttonSize = "btn-lg";
  else if (props.medium) buttonSize = "btn-md";
  else if (props.small) buttonSize = "btn-sm";

  let buttonType: "submit" | "button" | "reset" = "button";
  if (props.submit) buttonType = "submit";
  else if (props.reset) buttonType = "reset";

  const finalClassName = `${buttonClass} ${buttonText} ${buttonHover} ${buttonSize} ${
    props.unfocusable ? "no-focus" : ""
  } ${iconPosition == "end" ? "flex-row-reverse" : ""} ${
    loading ? "loading" : ""
  } ${className}`.trim();

  const onClick = (event: MouseEvent<HTMLAnchorElement> | MouseEvent<HTMLButtonElement>) => {
    if (!props.onClick) return;
    if (props.stopPropagation) event.stopPropagation();
    if (props.preventDefault) event.preventDefault();
    if (asyncLoading) {
      if (loading) return;

      setLoading(true);
      if (props.onFileClick) {
        fileRef.current?.click();
        return;
      }
      const promise = props.onClick(event);
      if (promise && promise.finally) {
        (promise as Promise<any>).finally(() => {
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    } else {
      props.onClick(event);
    }
  };

  const Children = (
    <>
      {props.icon && (
        <>
          {loading ? (
            <i className={`animate-spin ${iconClassName}`}>
              <CgSpinner />
            </i>
          ) : (
            <i className={`transition-none ${iconClassName}`}>{props.icon}</i>
          )}
        </>
      )}
      {props.text && (
        <span
          className={`relative transform transition-transform text-sm ${
            !props.icon && loading ? "translate-x-2.5" : ""
          }`}
        >
          {!props.icon && loading && (
            <i className="absolute transition animate-spin -left-5">
              <CgSpinner />
            </i>
          )}
          {props.text}
        </span>
      )}
      {props.children}
    </>
  );

  return (
    <>
      {props.onFileClick && (
        <input
          hidden
          type="file"
          ref={fileRef}
          onChange={(e) => {
            setUploading(true);
            const promise = props.onFileClick(e.target.files);
            if (promise && promise.finally) {
              (promise as Promise<any>).finally(() => {
                setUploading(false);
                e.target.value = null;
                setLoading(false);
              });
            } else {
              setLoading(false);
            }
          }}
        />
      )}
      {props.href ? (
        <Link
          id={props.id}
          href={props.href}
          ref={props.innerRef as MutableRefObject<HTMLAnchorElement>}
          target={props.targetBlank ? "_blank" : ""}
          className={`${finalClassName} ${
            loading || props.disabled ? "pointer-events-none opacity-50" : ""
          }`}
          download={props.download}
          style={style}
          onClick={(e) => onClick(e)}
          tabIndex={props.unfocusable && -1}
          data-tooltip={props.tooltip}
          data-placement={props.placement || "top"}
          aria-disabled={loading || props.disabled}
        >
          {Children}
        </Link>
      ) : (
        <button
          id={props.id}
          ref={props.innerRef as MutableRefObject<HTMLButtonElement>}
          type={buttonType}
          className={finalClassName}
          style={style}
          onClick={(e) => onClick(e)}
          disabled={loading || props.disabled}
          tabIndex={props.unfocusable && -1}
          data-tooltip={props.tooltip}
          data-placement={props.placement || "top"}
        >
          {Children}
        </button>
      )}
    </>
  );
}
