/**
 * Xử lý 1 file xóa logo + cập nhật upload list / history
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { RemoveLogoHistoryItem, RemoveLogoUploadItem } from "../constants";
import { useRemoveLogoApi } from "./useRemoveLogoApi";
import { uid, useRemoveLogoContext } from "../providers/remove-logo-provider";

export type ProcessOneResult = "ok" | "error" | "quota";

export function useProcessRemoveLogoFile() {
  const { t } = useTranslation();
  const toast = useToast();
  const { cleanWatermark } = useRemoveLogoApi();
  const { setUploads, addHistoryItems } = useRemoveLogoContext();

  const processOneFile = useCallback(
    async (u: RemoveLogoUploadItem, options?: { silentSuccess?: boolean }): Promise<ProcessOneResult> => {
      setUploads((prev) =>
        prev.map((item) =>
          item.id === u.id
            ? { ...item, status: "processing" as const, errorMessage: undefined }
            : item
        )
      );

      try {
        const result = await cleanWatermark([
          {
            clientId: u.id,
            kind: u.kind,
            mediaBase64: u.mediaBase64,
            mimeType: u.mimeType,
            name: u.name,
          },
        ]);

        const processed =
          result.processed.find((p) => p.clientId === u.id) || result.processed[0];
        const skipped = result.skipped.find((s) => s.clientId === u.id) || result.skipped[0];

        if (processed?.mediaBase64) {
          const historyItem: RemoveLogoHistoryItem = {
            id: uid(),
            kind: processed.kind,
            name: processed.name || u.name,
            mimeType: u.mimeType,
            sizeBytes: u.sizeBytes,
            originalBase64: u.mediaBase64,
            cleanedBase64: processed.mediaBase64,
            cleanedMimeType: processed.mimeType,
            cleanedUrl: processed.url,
            requestId: processed.requestId,
            credits: 1,
            createdAt: Date.now(),
          };

          setUploads((prev) =>
            prev.map((item) =>
              item.id === u.id ? { ...item, status: "done" as const, errorMessage: undefined } : item
            )
          );
          await addHistoryItems([historyItem]);
          if (!options?.silentSuccess) {
            toast.success(t("Đã xóa logo: {{name}}", { name: u.name }));
          }
          return "ok";
        }

        if (skipped) {
          const isQuota = skipped.code === "QUOTA_EXCEEDED";
          setUploads((prev) =>
            prev.map((item) =>
              item.id === u.id
                ? {
                    ...item,
                    status: (isQuota ? "skipped" : "error") as "skipped" | "error",
                    errorMessage: skipped.reason,
                  }
                : item
            )
          );
          if (isQuota) {
            toast.info(
              t("Hết hạn mức. Vui lòng nâng cấp gói hoặc chờ reset ngày mai.")
            );
            return "quota";
          }
          toast.error(`${u.name}: ${skipped.reason}`);
          return "error";
        }

        setUploads((prev) =>
          prev.map((item) =>
            item.id === u.id
              ? {
                  ...item,
                  status: "error" as const,
                  errorMessage: t("Không nhận được kết quả"),
                }
              : item
          )
        );
        toast.error(`${u.name}: ${t("Không nhận được kết quả")}`);
        return "error";
      } catch (err: any) {
        const msg = err?.message || t("Lỗi khi xóa logo");
        const isQuota = /hạn mức|nâng cấp gói|Basic trở lên|hết hạn/i.test(msg);
        setUploads((prev) =>
          prev.map((item) =>
            item.id === u.id
              ? {
                  ...item,
                  status: (isQuota ? "skipped" : "error") as "skipped" | "error",
                  errorMessage: msg,
                }
              : item
          )
        );
        toast.error(`${u.name}: ${msg}`);
        return isQuota ? "quota" : "error";
      }
    },
    [addHistoryItems, cleanWatermark, setUploads, t, toast]
  );

  return { processOneFile };
}
