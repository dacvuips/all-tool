/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useRouter } from "next/router";
import { useEffect, useMemo, useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import { RiLoader4Fill } from "react-icons/ri";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, ImageInput, Select, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS, StoryModeTypeEnum } from "../../constants";
import { ElementImagesUpload } from "../../elements/sibar/element-images-upload";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { getStoryboardSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import { ObjectPersonifyFieldTab } from "../../shared/object-personify-picker-dialog";
import { SuggestButton } from "../../shared/suggest-button";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
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
    storyModeType,
    setStoryModeType,
    storyboardImageStatuses,
    retryStoryboardImage,
    batchRunning,
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

  const tipContentLabel = (
    <span className="flex items-center gap-1.5 w-full">
      {t("Nội dung")}
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
  const introSteps = useMemo(() => getStoryboardSidebarIntroSteps(t), [t]);

  return (
    <>
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
    <div className="flex-1 bg-white">
      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3 ">
        {/* Ảnh storyboard */}
        <div id="storyboard-upload-section" className="mt-3">
          <ElementImagesUpload
            label={t("Ảnh storyboard")}
            artStyleImg={videoConfig?.storyboardImage}
            readOnly={!customer || batchRunning}
            onArtStyleImgChange={(v) => patchConfig && patchConfig({ storyboardImage: v })}
            getImageStatus={(index) => storyboardImageStatuses?.[index]}
            onRetryImage={(index) => retryStoryboardImage?.(index)}
          />
        </div>
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

        {/* NỘI DUNG MẸO (tipContent) */}
        <div id="tip-content-section">
          <Field noError name="tipContent" label={tipContentLabel}>
            <div
              className={`relative ${
                isSuggestLoading ? "opacity-40 pointer-events-none cursor-wait" : ""
              }`}
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
                <div className="absolute inset-0 flex items-center justify-center">
                  <RiLoader4Fill className="text-lg text-gray-400 animate-spin" />
                </div>
              )}
            </div>
          </Field>
        </div>

        {/* Ảnh sản phẩm */}

        <Field noError label={t("Ảnh sản phẩm tham chiếu (tùy chọn)")}>
          <div id="product-images-section">
          <ImageInput
            multi
            value={videoConfig?.productImages}
            onChange={(v) => patchConfig && patchConfig({ productImages: v })}
            readOnly={!customer}
            limit={5}
          />
          </div>
        </Field>
      </div>
    </div>
    </>
  );
};
