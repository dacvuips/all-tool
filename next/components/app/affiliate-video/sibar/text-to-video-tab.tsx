/**
 * text-to-video-tab.tsx
 * Sidebar layout: Form cấu hình + nút Submit
 * - i18n: tất cả text bọc trong t()
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiCameraLensFill, RiCloseLine, RiLoader4Fill, RiMagicFill } from "react-icons/ri";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { Button, Form } from "../../../shared/utilities/form";
import { TAB_TYPE } from "../constants";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

// ── SuggestButton – nút gợi ý AI (nằm trong <Form>) ──────────────────────
const SuggestButton = () => {
  const { t } = useTranslation();
  const { suggestConfig } = useAffiliateVideoApi();
  const { videoConfig, patchConfig } = useAffiliateVideoContext();
  const formContext = useFormContext();
  const [isLoading, setIsLoading] = useState(false);
  const { customer } = useAuth();
  /** Gọi AI gợi ý cấu hình nhân vật & nội dung mẹo */

  const handleSuggestConfig = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      const result = await suggestConfig({
        category: videoConfig?.category,
        mood: videoConfig?.mood,
        language: videoConfig?.language,
      });
      if (result) {
        // Cập nhật react-hook-form fields
        formContext?.setValue("objectToPersonify", result.objectToPersonify);
        formContext?.setValue("tipContent", result.tipContent);
        // Lưu vào provider state + IndexedDB
        patchConfig?.({
          objectToPersonify: result.objectToPersonify,
          tipContent: result.tipContent,
        });
      }
    } catch {
      // Lỗi đã được xử lý bằng toast trong suggestConfig
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Button
      outline
      info
      onClick={handleSuggestConfig}
      disabled={isLoading || !customer}
      className="h-7 px-2"
      icon={
        isLoading ? (
          <RiLoader4Fill className="text-xs animate-spin" />
        ) : (
          <RiMagicFill className="text-xs" />
        )
      }
      text={isLoading ? t("Đang gợi ý...") : t("Gợi ý")}
    />
  );
};

// ── TextToVideoTab – sidebar chính ─────────────────────────────────────────
export const TextToVideoTab = ({ onClose, type }: { onClose?: () => void; type: TAB_TYPE }) => {
  const { t } = useTranslation();
  const { handleSubmit, defaultVideoConfig, videoConfig, storyModeType } =
    useAffiliateVideoContext();

  /** Wrap handleSubmit: nếu single mode thì xoá batchSize để AI tự quyết định số scene */
  const wrappedSubmit = (data: any, promptText?: string) => {
    const mergedData = { ...data, batchSize: videoConfig?.batchSize ?? 8, storyModeType };
    if (type === TAB_TYPE.single) {
      const { batchSize, ...rest } = mergedData;
      return handleSubmit?.(rest, promptText);
    }
    return handleSubmit?.(mergedData, promptText);
  };

  return (
    <Form
      onSubmit={wrappedSubmit}
      defaultValues={defaultVideoConfig}
      className="flex flex-col h-full"
    >
      {/* ── Header: Tạo Nhân Vật (cố định) ── */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <RiCameraLensFill className="text-white text-base" />
          </div>
          <span className="text-base font-bold text-gray-800">{t("Tạo Nhân Vật")}</span>
        </div>
        <div className="flex items-center gap-1">
          <SuggestButton />
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="md:hidden w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center cursor-pointer border-0 transition-colors"
            >
              <RiCloseLine className="text-lg text-gray-600" />
            </button>
          )}
        </div>
      </div>

      {/* ── Vùng cấu hình (cuộn được) ── */}
      <div className="flex-1 min-h-0 overflow-y-auto v-scrollbar bg-white">
        <AffiliateConfig type={type} />
      </div>

      {/* ── Footer: Submit + Tip (cố định) ── */}
      <div className="flex-shrink-0 bg-white border-t border-gray-100">
        <AffiliateSubmit />
        {/* <Tip /> */}
      </div>
    </Form>
  );
};
