/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine } from "react-icons/ri";

import { useToast } from "../../../../../lib/providers/toast-provider";
import { Form } from "../../../../shared/utilities/form";

import { MdPreview } from "react-icons/md";
import { getImageDisplayName } from "../../elements/utils/elementFormImageUtils";
import { ReviewScriptTabEnum } from "../constants";
import { useReviewApi } from "../hook/useReviewApi";
import { useReviewContext } from "../providers/review-provider";
import { getArtStyleImages } from "../utils/reviewFormImageUtils";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const ReviewForm = ({ onClose }: { onClose?: () => void }) => {
  const { t } = useTranslation();
  const toast = useToast();
  const { generateReview } = useReviewApi();
  const { reviewFormConfig, setBatchRunning, setScriptData, setScriptTab, persistReviewInput } =
    useReviewContext();
  // ── Submit: tách prompt đánh số (1., 2., …) → từng cảnh ──
  const handleReviewSubmit = useCallback(
    async (_formData: any) => {
      const promptText = (reviewFormConfig?.prompt ?? "").trim();
      if (!promptText) {
        toast.error(t("Vui lòng nhập prompt phân cảnh"));
        return;
      }

      try {
        setBatchRunning?.(true);
        persistReviewInput?.();

        const artStyleImages = getArtStyleImages(reviewFormConfig).map((img) => ({
          ...img,
          name: getImageDisplayName(img), // "non_bao_hiem.webp" → "non_bao_hiem"
        }));
        const result = await generateReview({
          config: {
            ...reviewFormConfig,
            artStyleImg: artStyleImages,
          },
        });
        if (!result?.scenes?.length) {
          toast.error(
            `${t("Không tách được cảnh nào từ prompt")}. ${t("Dùng định dạng")}: ${t(
              "1" + "." + " " + t("mô tả cảnh")
            )}`
          );
          return;
        }

        setScriptData?.(result);
        setScriptTab?.(ReviewScriptTabEnum.batch);
        toast.success(t("Đã tạo {{count}} cảnh từ prompt", { count: result.scenes.length }));
      } catch (err: any) {
        console.error("[ReviewForm] generate review error:", err);
        toast.error(err?.message || t("Lỗi khi phân tích prompt"));
      } finally {
        setBatchRunning?.(false);
      }
    },
    [
      generateReview,
      reviewFormConfig,
      persistReviewInput,
      setBatchRunning,
      setScriptData,
      setScriptTab,
      toast,
    ]
  );

  return (
    <Form
      onSubmit={handleReviewSubmit}
      defaultValues={reviewFormConfig}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex justify-center items-center w-8 h-8 bg-red-500 rounded-full">
            <MdPreview className="text-base text-white" />
          </div>
          <span className="text-base font-bold text-gray-800">
            {t("Review Sản Phẩm/ Thời Trang")}
          </span>
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
