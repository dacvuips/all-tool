/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useRouter } from "next/router";
import { useState } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { Button, Field, Select } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS, StoryModeTypeEnum } from "../../constants";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { VideoUploadPicker } from "./video-upload-picker";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const { patchConfig, copyVideoFormConfig } = useCopyVideoContext();
  const formContext = useFormContext();
  const { ART_STYLE_TRANSLATED_OPTIONS, CATEGORY_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } =
    useOptionsTranslation();

  // Local state for instant UI feedback; synced from URL param on mount/navigation
  const initialMode = router.query.storyModeType as StoryModeTypeEnum;
  StoryModeTypeEnum.image_to_video;
  const [currentStoryModeType, setCurrentStoryModeType] = useState<StoryModeTypeEnum>(initialMode);

  return (
    <div className="flex-1 bg-white">
      {/* ── Mode Toggle: Prompt to Video / Image to Video ── */}
      <div className="px-4 pt-3 pb-2"></div>

      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
        {/* Upload Video tối đa 50MB*/}
        <div>
          <VideoUploadPicker
            label={t("Upload Video gốc")}
            maxSizeMB={50}
            onSelect={(result) => {
              if (result) {
                patchConfig && patchConfig({ sourceVideo: result } as any);
              }
            }}
          />
        </div>
        <div>
          <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
            <div className="grid grid-cols-2 gap-2">
              {ASPECT_RATIOS.map((ar) => {
                const isPortrait = ar.value === "9:16";
                const isActive = copyVideoFormConfig?.aspectRatio === ar.value;
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
          <Field noError name="artStyle" label={t("Phong cách hình ảnh")}>
            <Select
              native
              id="art-style-select"
              className="border-gray-200"
              options={ART_STYLE_TRANSLATED_OPTIONS}
              onChange={(v) => patchConfig && patchConfig({ artStyle: v })}
            />
          </Field>
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
      </div>
    </div>
  );
};
