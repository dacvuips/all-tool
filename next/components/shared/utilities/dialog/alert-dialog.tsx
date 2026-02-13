import { useEffect } from "react";

import { useTranslation } from "react-i18next";
import { AiOutlineQuestionCircle } from "react-icons/ai";
import { BiCheckCircle, BiError, BiErrorAlt, BiInfoCircle, BiXCircle } from "react-icons/bi";
import { Button } from "../form/button";
import { Dialog } from "./dialog";

export interface AlertDialogProps extends ReactProps {
  isOpen: boolean;
  type: "success" | "error" | "info" | "warn" | "question" | "danger" | "processbar";
  title: string;
  content?: string;
  confirm?: string;
  cancel?: string;
  onConfirm?: Function;
  onClose: () => any;
}

export function AlertDialog({
  type,
  confirm,
  cancel,
  onConfirm,
  onClose,
  title,
  content,
  ...props
}: AlertDialogProps) {
  const { t } = useTranslation();
  const icons = {
    info: <BiInfoCircle />,
    success: <BiCheckCircle />,
    error: <BiXCircle />,
    warn: <BiError />,
    question: <AiOutlineQuestionCircle />,
    danger: <BiErrorAlt />,
  };

  const iconColors = {
    info: "info",
    success: "success",
    error: "danger",
    warn: "warning",
    question: "primary",
    danger: "danger",
  };

  const onCancelClick = () => {
    onClose();
  };

  const onConfirmClick = async () => {
    if (onConfirm) await onConfirm();
  };

  useEffect(() => {
    if (props.isOpen) {
      document.getElementById("alert-dialog")?.focus();
    }
  }, [props.isOpen]);

  return (
    <Dialog
      width="400px"
      dialogClass="relative bg-white shadow-md rounded-2xl m-auto p-5"
      isOpen={props.isOpen}
      onClose={onClose}
      slideFromBottom="none"
    >
      <div className="flex flex-col items-center mt-2">
        <i className={`text-5xl opacity-75 text-${iconColors[type]}`}>{icons[type]}</i>
        <div className="w-full pt-0 pl-3 text-left md:pt-2 md:px-3 md:text-center">
          <h3 className="mb-1 text-xl font-semibold text-center text-gray-800">{title}</h3>
          <p className="mb-4 text-center text-gray-700 break-words">{content}</p>
        </div>
      </div>
      <form className="flex flex-row-reverse justify-start p-2 mt-4 -mx-5 -mb-5 border-t border-gray-200">
        <Button
          autoFocus
          id="alert-button"
          className="px-8 btn-large"
          primary={type == "question"}
          info={type == "info"}
          warning={type == "warn"}
          success={type == "success"}
          danger={type == "error" || type == "danger"}
          text={confirm || t("Xác nhận")}
          asyncLoading
          onClick={onConfirmClick}
        />
        {(type == "warn" || type == "question" || type == "danger") && (
          <Button large hoverDarken onClick={onCancelClick} text={cancel || t("Huỷ")} />
        )}
      </form>
    </Dialog>
  );
}
