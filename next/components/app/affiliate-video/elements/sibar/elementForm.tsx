/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiListOrdered } from "react-icons/ri";

import { useToast } from "../../../../../lib/providers/toast-provider";
import { Form } from "../../../../shared/utilities/form";
import { ElementScriptTabEnum } from "../../constants";
import { useElementContext } from "../providers/element-provider";
import { buildAnalysisDataFromNumberedPrompt } from "../utils/parseNumberedPrompt";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const ElementForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { elementFormConfig, setBatchRunning, setScriptData, setScriptTab, persistElementInput } =
    useElementContext();
  // ── Submit: tách prompt đánh số (1., 2., …) → từng cảnh ──
  const handleSubmit = useCallback(
    async (_formData: any) => {
      const promptText = (elementFormConfig?.prompt ?? "").trim();
      if (!promptText) {
        toast.error(t("Vui lòng nhập prompt phân cảnh"));
        return;
      }

      try {
        setBatchRunning?.(true);
        persistElementInput?.();

        const result = buildAnalysisDataFromNumberedPrompt(
          promptText,
          elementFormConfig?.aspectRatio,
          elementFormConfig?.artStyleId,
          elementFormConfig?.artStyle
        );
        if (!result?.scenes?.length) {
          toast.error(
            `${t("Không tách được cảnh nào từ prompt")}. ${t("Dùng định dạng")}: ${t(
              "1" + "." + " " + t("mô tả cảnh")
            )}`
          );
          return;
        }

        setScriptData?.(result);
        setScriptTab?.(ElementScriptTabEnum.batch);
        toast.success(t("Đã tạo {{count}} cảnh từ prompt", { count: result.scenes.length }));
      } catch (err: any) {
        console.error("[ElementForm] parse prompt error:", err);
        toast.error(err?.message || t("Lỗi khi phân tích prompt"));
      } finally {
        setBatchRunning?.(false);
      }
    },
    [elementFormConfig, persistElementInput, setBatchRunning, setScriptData, setScriptTab, t, toast]
  );

  return (
    <Form
      onSubmit={handleSubmit}
      defaultValues={elementFormConfig}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex justify-center items-center w-8 h-8 bg-red-500 rounded-full">
            <RiListOrdered className="text-base text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-800">{t("Thành phần video")}</span>
            <span className="text-xs text-gray-500">
              {t("Tạo phân cảnh theo hàng loạt từ prompt tùy chỉnh")}
            </span>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer md:hidden hover:bg-gray-200"
            >
              <RiCloseLine className="text-lg text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* ── Vùng cấu hình (cuộn được) ── */}
      <div className="overflow-y-auto flex-1 min-h-0 bg-white v-scrollbar">
        <AffiliateConfig />
      </div>

      {/* ── Footer: Submit + Tip (cố định) ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <AffiliateSubmit />
        {/* <Tip /> */}
      </div>
    </Form>
  );
};
