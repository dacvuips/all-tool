/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import { RiCameraLensFill, RiFilmFill } from "react-icons/ri";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, ImageInput, Select, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS, StoryModeTypeEnum, TAB_TYPE } from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import { ObjectPersonifyPickerDialog } from "../../shared/object-personify-picker-dialog";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchSizeSlider } from "./batch-size-slider";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = ({ type }: { type: TAB_TYPE }) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const router = useRouter();
  const { videoConfig, patchConfig, storyModeType, setStoryModeType } = useAffiliateVideoContext();
  const formContext = useFormContext();
  const { ART_STYLE_TRANSLATED_OPTIONS, CATEGORY_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } =
    useOptionsTranslation();

  // Local state for instant UI feedback; synced from URL param on mount/navigation
  const initialMode =
    (router.query.storyModeType as StoryModeTypeEnum) ||
    storyModeType ||
    StoryModeTypeEnum.image_to_video;
  const [currentStoryModeType, setCurrentStoryModeType] = useState<StoryModeTypeEnum>(initialMode);

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

  return (
    <div className="flex-1 bg-white">
      {/* ── Mode Toggle: Prompt to Video / Image to Video ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
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
                    onClick={() => patchConfig && patchConfig({ aspectRatio: ar.value })}
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

        {/* CHỦ ĐỀ / DANH MỤC */}
        <div>
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
        <div>
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
            onChange={(v) => patchConfig && patchConfig({ objectToPersonify: v })}
            onCodeChange={(code) => patchConfig && patchConfig({ objectToPersonifyCode: code })}
          />
        </div>

        {/* NỘI DUNG MẸO (tipContent) */}
        <div>
          <Field noError name="tipContent" label={t("Nội dung mẹo")}>
            <Textarea
              id="tip-content-input"
              className="border-gray-200"
              placeholder={`${t("VD")}: ${t("Cách ăn chuối tốt nhất")}`}
              onChange={(v) => patchConfig && patchConfig({ tipContent: v })}
              maxRows={4}
            />
          </Field>
        </div>

        {/* Ảnh sản phẩm */}

        <Field noError label={t("Ảnh sản phẩm tham chiếu (tùy chọn)")}>
          <ImageInput
            multi
            value={videoConfig?.productImages}
            onChange={(v) => patchConfig && patchConfig({ productImages: v })}
            readOnly={!customer}
          />
        </Field>

        {/* SỐ LƯỢNG MẸO CẦN TẠO (batchSize) */}
        {type == TAB_TYPE.batch && (
          <BatchSizeSlider
            value={videoConfig?.batchSize ?? 8}
            onChange={(v) => {
              if (patchConfig) patchConfig({ batchSize: v });
              if (formContext) formContext.setValue("batchSize", v);
            }}
          />
        )}
      </div>
    </div>
  );
};
