/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import {
  RiCameraLensFill,
  RiFilmFill,
  RiLoader4Fill,
  RiMagicFill,
  RiMovie2Fill,
} from "react-icons/ri";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import {
  Button,
  Field,
  Label,
  Select,
  Textarea,
} from "../../../../shared/utilities/form";
import { ASPECT_RATIOS, StoryModeTypeEnum, TAB_TYPE, TrendingModeTypeEnum } from "../../constants";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { ProductImagesUpload } from "../../shared/product-images-upload";
import { getSingleSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import {
  ObjectPersonifyFieldTab,
  ObjectPersonifyPickerDialog,
} from "../../shared/object-personify-picker-dialog";
import { SuggestButton } from "../../shared/suggest-button";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchSizeSlider } from "./batch-size-slider";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = ({
  type,
  introOpen = false,
  onIntroDismiss,
}: {
  type: TAB_TYPE;
  introOpen?: boolean;
  onIntroDismiss?: () => void;
}) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const router = useRouter();
  const {
    videoConfig,
    patchConfig,
    storyModeType,
    setStoryModeType,
    trendingModeType,
    setTrendingModeType,
  } = useAffiliateVideoContext();
  const formContext = useFormContext();
  const { ART_STYLE_TRANSLATED_OPTIONS, CATEGORY_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } =
    useOptionsTranslation();

  // Local state for instant UI feedback; synced from URL param on mount/navigation
  const initialMode =
    (router.query.storyModeType as StoryModeTypeEnum) ||
    storyModeType ||
    StoryModeTypeEnum.image_to_video;
  const [currentStoryModeType, setCurrentStoryModeType] = useState<StoryModeTypeEnum>(initialMode);

  // Local state cho switch "Tự động" / "Tùy chỉnh phân cảnh"
  const initialTrendingMode =
    (router.query.trendingModeType as TrendingModeTypeEnum) ||
    trendingModeType ||
    videoConfig?.trendingModeType ||
    TrendingModeTypeEnum.single_variant;
  const [currentTrendingModeType, setCurrentTrendingModeType] =
    useState<TrendingModeTypeEnum>(initialTrendingMode);

  const [isSuggestLoading, setIsSuggestLoading] = useState(false);
  const [objectPersonifyFieldTab, setObjectPersonifyFieldTab] =
    useState<ObjectPersonifyFieldTab>("image");

  // Sync from URL param when it changes (e.g. browser back/forward)
  useEffect(() => {
    if (router.query.storyModeType) {
      const typeFromQuery = router.query.storyModeType as string;
      if (Object.values(StoryModeTypeEnum).includes(typeFromQuery as any)) {
        setCurrentStoryModeType(typeFromQuery as StoryModeTypeEnum);
        if (setStoryModeType) setStoryModeType(typeFromQuery as StoryModeTypeEnum);
        if (patchConfig) patchConfig({ storyModeType: typeFromQuery as StoryModeTypeEnum });
        if (formContext) formContext.setValue("storyModeType", typeFromQuery as StoryModeTypeEnum);
      }
    }
  }, [router.query.storyModeType]);

  // Đồng bộ trendingModeType từ URL param (browser back/forward, deep-link)
  useEffect(() => {
    if (router.query.trendingModeType) {
      const typeFromQuery = router.query.trendingModeType as string;
      if (Object.values(TrendingModeTypeEnum).includes(typeFromQuery as any)) {
        setCurrentTrendingModeType(typeFromQuery as TrendingModeTypeEnum);
        if (setTrendingModeType) setTrendingModeType(typeFromQuery as TrendingModeTypeEnum);
        if (patchConfig) patchConfig({ trendingModeType: typeFromQuery as TrendingModeTypeEnum });
        if (formContext)
          formContext.setValue("trendingModeType", typeFromQuery as TrendingModeTypeEnum);
      }
    }
  }, [router.query.trendingModeType]);

  /**
   * Hàm dùng chung khi chuyển đổi switch "Tự động" / "Tùy chỉnh phân cảnh".
   * Cập nhật: state nội bộ, provider, form context, URL query param.
   */
  const handleTrendingModeChange = useCallback(
    (mode: TrendingModeTypeEnum) => {
      setCurrentTrendingModeType(mode);
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

  const tipContentLabel = (
    <span className="flex items-center gap-1.5 w-full">
      {t("Nội dung mẹo")}
      <SuggestButton
        className="w-full"
        suggestParams={{
          category: videoConfig?.category,
          mood: videoConfig?.mood,
          language: videoConfig?.language,
        }}
        onLoadingChange={setIsSuggestLoading}
        onSuggestResult={(result) => {
          console.log(result);
          patchConfig?.({
            objectToPersonify: result.objectToPersonify,
            tipContent: result.tipContent,
          });
          setObjectPersonifyFieldTab("prompt");
        }}
      />
    </span>
  );
  const introSteps = useMemo(
    () => getSingleSidebarIntroSteps(t, { isBatch: type === TAB_TYPE.batch }),
    [t, type]
  );

  return (
    <>
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
      <div className="flex-1 bg-white">
        {/* ── Mode Toggle: Prompt to Video / Image to Video ── */}
        <div id="story-mode-section" className="px-4 pt-3 pb-2">
          <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
            <div
              onClick={() => {
                setCurrentStoryModeType(StoryModeTypeEnum.prompt_to_video);
                if (setStoryModeType) setStoryModeType(StoryModeTypeEnum.prompt_to_video);
                if (patchConfig) patchConfig({ storyModeType: StoryModeTypeEnum.prompt_to_video });
                if (formContext)
                  formContext.setValue("storyModeType", StoryModeTypeEnum.prompt_to_video);
                router.push(
                  {
                    pathname: router.pathname,
                    query: { ...router.query, storyModeType: StoryModeTypeEnum.prompt_to_video },
                  },
                  undefined,
                  { shallow: true }
                );
              }}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                currentStoryModeType === StoryModeTypeEnum.prompt_to_video
                  ? "bg-white text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <RiFilmFill
                className={
                  currentStoryModeType === StoryModeTypeEnum.prompt_to_video
                    ? "text-pink-500"
                    : "text-gray-400"
                }
              />
              {t("Prompt to Video")}
            </div>
            <div
              onClick={() => {
                setCurrentStoryModeType(StoryModeTypeEnum.image_to_video);
                if (setStoryModeType) setStoryModeType(StoryModeTypeEnum.image_to_video);
                if (patchConfig) patchConfig({ storyModeType: StoryModeTypeEnum.image_to_video });
                if (formContext)
                  formContext.setValue("storyModeType", StoryModeTypeEnum.image_to_video);
                router.push(
                  {
                    pathname: router.pathname,
                    query: { ...router.query, storyModeType: StoryModeTypeEnum.image_to_video },
                  },
                  undefined,
                  { shallow: true }
                );
              }}
              className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                currentStoryModeType === StoryModeTypeEnum.image_to_video
                  ? "bg-white  text-gray-800 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <RiCameraLensFill
                className={
                  currentStoryModeType === StoryModeTypeEnum.image_to_video
                    ? "text-pink-500"
                    : "text-gray-400"
                }
              />
              {t("Image to Video")}
            </div>
          </div>
        </div>

        {/* ── Form Fields ── */}

        <div className="px-4 pb-4 space-y-3">
          {/* TỈ LỆ KHUNG HÌNH */}
          <div id="aspect-ratio-section">
            <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
              <div className="grid grid-cols-2 gap-2">
                {ASPECT_RATIOS.map((ar) => {
                  const isPortrait = ar.value === "9:16";
                  const isActive = videoConfig?.aspectRatio === ar.value;
                  return (
                    <Button
                      key={ar.value}
                      id={`aspect-ratio-${ar.value.replace(":", "-")}`}
                      onClick={() => patchConfig && patchConfig({ aspectRatio: ar.value })}
                      className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                        isActive
                          ? "text-blue-600 bg-blue-50 border-blue-400"
                          : "text-gray-600 bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <span className="text-base">
                        {isPortrait ? (
                          <BsFile />
                        ) : (
                          <BsFile style={{ transform: "rotate(90deg)" }} />
                        )}
                      </span>
                      {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                    </Button>
                  );
                })}
              </div>
            </Field>
          </div>
          {/* ART STYLE */}
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

          {/* CHỦ ĐỀ / DANH MỤC */}
          <div id="category-section">
            <Field noError name="category" label={t("Chủ đề / Danh mục")}>
              <Select
                native
                id="category-select"
                className="border-gray-200"
                options={CATEGORY_OPTIONS}
                onChange={(v) => patchConfig && patchConfig({ category: v })}
              />
            </Field>
          </div>

          {/* MOOD / TÍNH CÁCH */}
          <div id="mood-section">
            <Field noError name="mood" label={t("Tính cách / Mood")}>
              <Select
                native
                id="mood-select"
                className="border-gray-200"
                options={MOOD_OPTIONS}
                onChange={(v) => patchConfig && patchConfig({ mood: v })}
              />
            </Field>
          </div>

          {/* NHÂN HOÁ ĐỒ VẬT (objectToPersonify) */}
          <div>
            <ObjectPersonifyPickerDialog
              name="objectToPersonify"
              value={videoConfig?.objectToPersonify}
              fieldTab={objectPersonifyFieldTab}
              onFieldTabChange={setObjectPersonifyFieldTab}
              onChange={(v) =>
                patchConfig &&
                patchConfig({
                  objectToPersonify: v,
                  ...(v?.trim() ? { objectToPersonifyImage: undefined } : {}),
                })
              }
              onCodeChange={(code) => patchConfig && patchConfig({ objectToPersonifyCode: code })}
              imageValue={videoConfig?.objectToPersonifyImage}
              onImageChange={(v) =>
                patchConfig &&
                patchConfig({
                  objectToPersonifyImage: v,
                  ...(v?.imageBytes
                    ? { objectToPersonify: "", objectToPersonifyCode: undefined }
                    : {}),
                })
              }
              readOnly={!customer}
            />
          </div>

          {/* NỘI DUNG MẸO (tipContent) */}
          <div id="tip-content-section">
            <Field noError name="tipContent" label={tipContentLabel}>
              <div
                className={`relative ${
                  isSuggestLoading ? "opacity-40 cursor-wait pointer-events-none" : ""}`}
              >
                <Textarea
                  id="tip-content-input"
                  className="border-gray-200"
                  value={videoConfig?.tipContent || ""}
                  placeholder={`${t("VD")}: ${t("Cách ăn chuối tốt nhất")}`}
                  onChange={(v) => patchConfig && patchConfig({ tipContent: v })}
                  readOnly={isSuggestLoading}
                  maxRows={4}
                />
                {isSuggestLoading && (
                  <div className="flex absolute inset-0 justify-center items-center">
                    <RiLoader4Fill className="text-lg text-gray-400 animate-spin" />
                  </div>
                )}
              </div>
            </Field>
          </div>

          {/* Ảnh sản phẩm */}

          <div id="product-images-section">
            <ProductImagesUpload
              productImageRefs={videoConfig?.productImageRefs}
              productImages={videoConfig?.productImages}
              onChange={(patch) => patchConfig && patchConfig(patch)}
              readOnly={!customer}
            />
          </div>
          <Label text={t("Tùy chỉnh số lượng phân cảnh")} />
          {/* SỐ LƯỢNG MẸO CẦN TẠO (batchSize) + Switch "Tự động" / "Tùy chỉnh phân cảnh" */}
          {type == TAB_TYPE.batch && (
            <>
              {/* ── Switch chế độ tạo: Tự động / Tùy chỉnh phân cảnh ── */}
              <div id="trending-mode-section" style={{ marginTop: "0.25rem" }}>
                <div className="grid grid-cols-2 gap-1 p-1 bg-gray-100 rounded-xl">
                  {/* Tab "Tự động" – tương ứng single_variant */}
                  <div
                    onClick={() => handleTrendingModeChange(TrendingModeTypeEnum.single_variant)}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                      currentTrendingModeType === TrendingModeTypeEnum.single_variant
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <RiMagicFill
                      className={
                        currentTrendingModeType === TrendingModeTypeEnum.single_variant
                          ? "text-pink-500"
                          : "text-gray-400"
                      }
                    />
                    {t("Tự động")}
                  </div>
                  {/* Tab "Tùy chỉnh phân cảnh" – tương ứng story_script */}
                  <div
                    onClick={() => handleTrendingModeChange(TrendingModeTypeEnum.story_script)}
                    className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
                      currentTrendingModeType === TrendingModeTypeEnum.story_script
                        ? "bg-white text-gray-800 shadow-sm"
                        : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <RiMovie2Fill
                      className={
                        currentTrendingModeType === TrendingModeTypeEnum.story_script
                          ? "text-pink-500"
                          : "text-gray-400"
                      }
                    />
                    {t("Tùy chỉnh phân cảnh")}
                  </div>
                </div>
              </div>
              {currentTrendingModeType === TrendingModeTypeEnum.story_script && (
                <BatchSizeSlider
                  value={videoConfig?.batchSize ?? 8}
                  onChange={(v) => {
                    if (patchConfig) patchConfig({ batchSize: v });
                    if (formContext) formContext.setValue("batchSize", v);
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
};
