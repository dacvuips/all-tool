/**
 * text-to-video-tab.tsx
 * Sidebar layout: Config form + Submit button, light theme
 */
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { RiCameraLensFill, RiLoader4Fill, RiMagicFill } from "react-icons/ri";
import { Button, Form } from "../../../shared/utilities/form";
import { useAffiliateVideoApi } from "../hook/useAffiliateVideoApi";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";
import { Tip } from "./tip";

/** Inner component – lives inside <Form> so useFormContext is available */
const SuggestButton = () => {
  const { t } = useTranslation();
  const { suggestConfig } = useAffiliateVideoApi();
  const { videoConfig, patchConfig } = useAffiliateVideoContext();
  const formContext = useFormContext();
  const [loading, setLoading] = useState(false);

  const handleSuggest = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await suggestConfig({
        category: videoConfig?.category,
        mood: videoConfig?.mood,
        language: videoConfig?.language,
      });
      if (result) {
        // Update react-hook-form fields
        formContext?.setValue("objectToPersonify", result.objectToPersonify);
        formContext?.setValue("tipContent", result.tipContent);
        // Persist to provider state + IndexedDB
        patchConfig?.({
          objectToPersonify: result.objectToPersonify,
          tipContent: result.tipContent,
        });
      }
    } catch {
      // Error already handled by toast inside suggestConfig
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      outline
      info
      onClick={handleSuggest}
      disabled={loading}
      className="h-7 px-2"
      icon={
        loading ? (
          <RiLoader4Fill className="text-xs animate-spin" />
        ) : (
          <RiMagicFill className="text-xs" />
        )
      }
      text={loading ? t("Đang gợi ý...") : t("Gợi ý")}
    />
  );
};

export const TextToVideoTab = () => {
  const { t } = useTranslation();
  const { handleSubmit, defaultVideoConfig } = useAffiliateVideoContext();
  return (
    <Form onSubmit={handleSubmit} defaultValues={defaultVideoConfig} className="flex flex-col h-full">
        {/* ── Header: Tạo Nhân Vật (fixed) ── */}
        <div className="flex-shrink-0 flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
              <RiCameraLensFill className="text-white text-base" />
            </div>
            <span className="text-base font-bold text-gray-800">{t("Tạo Nhân Vật")}</span>
          </div>
          {/* SuggestButton lives inside <Form> below – but header is outside.
              We move it inside Form via a render trick below. */}

          <SuggestButton />
        </div>

        {/* ── Scrollable config area ── */}
        <div className="flex-1 min-h-0 overflow-y-auto v-scrollbar bg-white">
          <AffiliateConfig />
        </div>

        {/* ── Footer: Submit + Tip (fixed) ── */}
        <div className="flex-shrink-0 bg-white border-t border-gray-100">
          <AffiliateSubmit />
          <Tip />
        </div>
    </Form>
  );
};
