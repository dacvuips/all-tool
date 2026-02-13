import React, { createContext, useContext } from "react";
import { AiFillInfoCircle } from "react-icons/ai";
import { HiCheck, HiX } from "react-icons/hi";
import { IoWarning } from "react-icons/io5";
import {
  Slide,
  ToastContainer,
  ToastContent,
  ToastOptions,
  toast as toastify,
} from "react-toastify";

const ToastContext = createContext<{
  default: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
  info: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
  success: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
  error: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
  warn: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
  dark: (content: ToastContent, options?: ToastOptions | undefined) => React.ReactText;
}>(null);

export function ToastProvider({ children }: any) {
  // const defaultOptions: ToastOptions = {
  //   autoClose: 2500,
  //   hideProgressBar: true,
  //   closeOnClick: true,
  //   pauseOnHover: true,
  //   draggable: false,
  //   pauseOnFocusLoss: true,
  //   position: toastify.POSITION.BOTTOM_CENTER,
  // };
  const defaultOptions: ToastOptions = {
    autoClose: 2500,
    hideProgressBar: true,
    closeOnClick: true,
    pauseOnHover: true,
    draggable: false,
    pauseOnFocusLoss: false,
    bodyClassName: "font-medium",
    closeButton: false,
    position: toastify.POSITION.BOTTOM_CENTER,
  };
  const icons = {
    info: <AiFillInfoCircle />,
    success: <HiCheck />,
    error: <HiX />,
    warn: <IoWarning />,
  };
  const createToastContent = (
    type: "info" | "success" | "error" | "warn",
    content: ToastContent
  ) => (
    <div className="flex items-start font-medium">
      <i className="mr-2 pt-0.5 text-xl">{icons[type]}</i>
      {content}
    </div>
  );

  const toast = {
    default: (content: ToastContent, options?: ToastOptions) =>
      toastify(content, { ...defaultOptions, ...options }),
    dark: (content: ToastContent, options?: ToastOptions) =>
      toastify.dark(content, { ...defaultOptions, ...options }),
    info: (content: ToastContent, options?: ToastOptions) =>
      toastify.info(createToastContent("info", content), {
        className: "bg-info",
        ...defaultOptions,
        ...options,
      }),
    success: (content: ToastContent, options?: ToastOptions) =>
      toastify.success(createToastContent("success", content), {
        className: "bg-success",
        ...defaultOptions,
        ...options,
      }),
    error: (content: ToastContent, options?: ToastOptions) =>
      toastify.error(createToastContent("error", content), {
        className: "bg-danger",
        ...defaultOptions,
        ...options,
      }),
    warn: (content: ToastContent, options?: ToastOptions) =>
      toastify.warn(createToastContent("warn", content), {
        className: "bg-warn",
        ...defaultOptions,
        ...options,
      }),
  };

  // const toast = {
  //   default: (content: string, options?: ToastOptions) =>
  //     toastify(content, { ...defaultOptions, ...options }),
  //   info: (content: string, options?: ToastOptions) =>
  //     toastify.info(content, { ...defaultOptions, ...options }),
  //   success: (content: string, options?: ToastOptions) =>
  //     toastify.success(content, { ...defaultOptions, ...options }),
  //   error: (content: string, options?: ToastOptions) =>
  //     toastify.error(content, { ...defaultOptions, ...options }),
  //   warn: (content: string, options?: ToastOptions) =>
  //     toastify.warn(content, { ...defaultOptions, ...options }),
  //   dark: (content: string, options?: ToastOptions) =>
  //     toastify.dark(content, { ...defaultOptions, ...options }),
  // };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer newestOnTop containerId="toast-root" limit={5} transition={Slide} />
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
