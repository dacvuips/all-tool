"use client";

import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../providers/toast-provider";

export const useNetworkMonitor = () => {
  const ref = useRef(true);
  const toast = useToast();
  const { t } = useTranslation();
  const handleStatusChange = useCallback(() => {
    const onLine = window?.navigator?.onLine;

    if (onLine !== ref.current) {
      if (onLine) {
        toast.info(t("Network & Internet đã kết nối trở lại"));
      } else {
        toast.error(t("Network & Internet bị ngắt kết nối"));
      }
    }
    ref.current = onLine;
  }, [toast]);

  useEffect(() => {
    window.addEventListener("online", handleStatusChange);
    window.addEventListener("offline", handleStatusChange);
    return () => {
      window.removeEventListener("online", handleStatusChange);
      window.removeEventListener("offline", handleStatusChange);
    };
  }, [handleStatusChange]);
};
