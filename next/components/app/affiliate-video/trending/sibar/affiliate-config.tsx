/**
 * affiliate-config.tsx (trending)
 * Sidebar form cấu hình: chọn mode, tỉ lệ, phong cách, prompt, v.v.
 * Light theme – className only, Tailwind CSS
 * Field names khớp với AffiliateVideoFormConfig interface.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, Select, Textarea } from "../../../../shared/utilities/form";
import {
  BATCH_SIZE_DESCRIPTIONS,
  BATCH_SIZE_LABELS,
  TrendingModeTypeEnum,
} from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { AspectRatioPicker } from "../../shared/aspect-ratio-picker";
import { ProductImagesUpload } from "../../shared/product-images-upload";
import { getTrendingSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";

import { RiCameraLensFill, RiFilmFill } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchSizeSlider } from "./batch-size-slider";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = ({
  introOpen = false,
  onIntroDismiss,
}: {
  introOpen?: boolean;
  onIntroDismiss?: () => void;
}) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const router = useRouter();
  const {
    videoConfig,
    patchConfig,
    trendingModeType,
    setTrendingModeType,
    pendingPrompt,
    setPendingPrompt,
  } = useAffiliateVideoContext();
  const formContext = useFormContext();

  // Khi nhận pendingPrompt từ "Dùng ngay" → cập nhật react-hook-form value
  useEffect(() => {
    if (pendingPrompt && formContext) {
      formContext.setValue("tipContent", pendingPrompt);
      if (setPendingPrompt) setPendingPrompt(null);
    }
  }, [pendingPrompt]);
  const { ART_STYLE_TRANSLATED_OPTIONS, CATEGORY_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } =
    useOptionsTranslation();

  // State nội bộ để UI phản hồi ngay khi chuyển tab; đồng bộ từ URL khi mount/navigation
  const initialMode =
    (router.query.trendingModeType as TrendingModeTypeEnum) ||
    trendingModeType ||
    TrendingModeTypeEnum.story_script;
  const [currentStoryModeType, setCurrentStoryModeType] =
    useState<TrendingModeTypeEnum>(initialMode);

  // Đồng bộ từ URL param khi thay đổi (VD: browser back/forward)
  useEffect(() => {
    if (router.query.trendingModeType) {
      const typeFromQuery = router.query.trendingModeType as string;
      if (Object.values(TrendingModeTypeEnum).includes(typeFromQuery as any)) {
        setCurrentStoryModeType(typeFromQuery as TrendingModeTypeEnum);
        if (setTrendingModeType) setTrendingModeType(typeFromQuery as TrendingModeTypeEnum);
        if (patchConfig) patchConfig({ trendingModeType: typeFromQuery as TrendingModeTypeEnum });
        if (formContext)
          formContext.setValue("trendingModeType", typeFromQuery as TrendingModeTypeEnum);
      }
    }
  }, [router.query.trendingModeType]);

  /**
   * Hàm dùng chung khi chuyển đổi tab mode (Đơn Lẻ / Cốt truyện).
   * Cập nhật: state nội bộ, provider, form context, URL query param.
   */
  const handleModeChange = useCallback(
    (mode: TrendingModeTypeEnum) => {
      setCurrentStoryModeType(mode);
      if (setTrendingModeType) setTrendingModeType(mode);
      if (patchConfig) patchConfig({ trendingModeType: mode });
      if (formContext) formContext.setValue("trendingModeType", mode);
      router.push(
        {
          pathname: router.pathname,
          query: { ...router.query, trendingModeType: mode },
        },
        undefined,
        { shallow: true }
      );
    },
    [setTrendingModeType, patchConfig, formContext, router]
  );

  const introSteps = useMemo(() => getTrendingSidebarIntroSteps(t), [t]);

  return (
    <>
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
    <div className="flex-1 bg-white">
      {/* ── Chuyển đổi Mode: Đơn Lẻ / Cốt truyện ── */}
      <div id="trending-mode-section" className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
          {/* Tab "Đơn Lẻ" */}
          <div
            onClick={() => handleModeChange(TrendingModeTypeEnum.single_variant)}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              currentStoryModeType === TrendingModeTypeEnum.single_variant
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiFilmFill
              className={
                currentStoryModeType === TrendingModeTypeEnum.single_variant
                  ? "text-pink-500"
                  : "text-gray-400"
              }
            />
            {t("Đơn Lẻ")}
          </div>
          {/* Tab "Cốt truyện/kịch bản" */}
          <div
            onClick={() => handleModeChange(TrendingModeTypeEnum.story_script)}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              currentStoryModeType === TrendingModeTypeEnum.story_script
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiCameraLensFill
              className={
                currentStoryModeType === TrendingModeTypeEnum.story_script
                  ? "text-pink-500"
                  : "text-gray-400"
              }
            />
            {t("Cốt truyện/kịch bản")}
          </div>
        </div>
      </div>

      {/* ── Các trường cấu hình ── */}

      <div className="px-4 pb-4 space-y-3">
        {/* TỈ LỆ KHUNG HÌNH */}
        <div id="aspect-ratio-section">
          <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
            <AspectRatioPicker
              value={videoConfig?.aspectRatio}
              onChange={(aspectRatio) => {
                if (patchConfig) patchConfig({ aspectRatio });
                if (formContext) formContext.setValue("aspectRatio", aspectRatio);
              }}
            />
          </Field>
        </div>
        {/* PHONG CÁCH HÌNH ẢNH */}
        <div>
          <ArtStylePickerDialog
            name="artStyle"
            value={videoConfig?.artStyle}
            onChange={(v) => patchConfig && patchConfig({ artStyle: v })}
            onCodeChange={(code) => patchConfig && patchConfig({ artStyleId: code })}
          />
        </div>

        {/* NGÔN NGỮ LỜI THOẠI */}
        <div id="language-section">
          <Field noError name="language" label={t("Ngôn ngữ lời thoại")}>
            <Select
              native
              id="language-select"
              className="border-gray-200"
              options={LANGUAGE_OPTIONS}
              onChange={(v) => patchConfig && patchConfig({ language: v })}
            />
          </Field>
        </div>

        {/* NỘI DUNG PROMPT */}
        <div id="tip-content-section">
          <Field noError name="tipContent" label={t("Prompt")}>
            <Textarea
              maxRows={4}
              id="tip-content-input"
              className="border-gray-200"
              value={videoConfig?.tipContent || ""}
              placeholder={`${t("VD")}: ${t("Cách ăn chuối tốt nhất")}`}
              onChange={(v) => patchConfig && patchConfig({ tipContent: v })}
            />
          </Field>
        </div>

        {/* ẢNH THAM CHIẾU (tuỳ chọn) */}

        <div id="product-images-section">
          <ProductImagesUpload
            productImageRefs={videoConfig?.productImageRefs}
            productImages={videoConfig?.productImages}
            onChange={(patch) => patchConfig && patchConfig(patch)}
            readOnly={!customer}
          />
        </div>

        {/* SLIDER SỐ LƯỢNG – label & mô tả thay đổi theo mode */}
        <BatchSizeSlider
          value={videoConfig?.batchSize ?? 8}
          onChange={(v) => {
            if (patchConfig) patchConfig({ batchSize: v });
            if (formContext) formContext.setValue("batchSize", v);
          }}
          label={BATCH_SIZE_LABELS[currentStoryModeType]}
          description={BATCH_SIZE_DESCRIPTIONS[currentStoryModeType]}
        />
      </div>
    </div>
    </>
  );
};
