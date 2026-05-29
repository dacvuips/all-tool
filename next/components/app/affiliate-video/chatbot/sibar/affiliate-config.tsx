/**
 * affiliate-config.tsx (trending)
 * Sidebar form cấu hình: chọn mode, tỉ lệ, phong cách, prompt, v.v.
 * Light theme – className only, Tailwind CSS
 * Field names khớp với AffiliateVideoFormConfig interface.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, ImageInput, Select, Textarea } from "../../../../shared/utilities/form";
import {
  ASPECT_RATIOS,
  BATCH_SIZE_DESCRIPTIONS,
  BATCH_SIZE_LABELS,
  TrendingModeTypeEnum,
} from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";

import { RiCameraLensFill, RiFilmFill } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchSizeSlider } from "./batch-size-slider";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
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

  return (
    <div className="flex-1 bg-white">
      {/* ── Chuyển đổi Mode: Đơn Lẻ / Cốt truyện ── */}
      <div className="px-4 pt-3 pb-2">
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
        <div>
          <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ar) => {
                const isPortrait = ar.value === "9:16";
                const isActive = videoConfig?.aspectRatio === ar.value;
                return (
                  <Button
                    key={ar.value}
                    id={`aspect-ratio-${ar.value.replace(":", "-")}`}
                    onClick={() => {
                      if (patchConfig) patchConfig({ aspectRatio: ar.value });
                      if (formContext) formContext.setValue("aspectRatio", ar.value);
                    }}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                      isActive
                        ? "border-blue-400 bg-blue-50 text-blue-600"
                        : "border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    <span className="text-base">
                      {isPortrait ? <BsFile /> : <BsFile style={{ transform: "rotate(90deg)" }} />}
                    </span>
                    {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                  </Button>
                );
              })}
            </div>
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
        <div>
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
        <div>
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

        <Field noError label={t("Ảnh sản phẩm tham chiếu (tùy chọn)")}>
          <ImageInput
            multi
            value={videoConfig?.productImages}
            onChange={(v) => patchConfig && patchConfig({ productImages: v })}
            readOnly={!customer}
          />
        </Field>

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
  );
};
