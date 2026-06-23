/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, ImageInput, Select } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS } from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { ObjectPersonifyPickerDialog } from "../../shared/object-personify-picker-dialog";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { getCopyVideoSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";
import { useCopyVideoContext } from "../providers/copy-video-provider";
import { VideoUploadPicker } from "./video-upload-picker";

// ── Main Component ────────────────────────────────────────────────────────

interface AffiliateConfigProps {
  introOpen?: boolean;
  onIntroDismiss?: () => void;
}

export const AffiliateConfig = ({ introOpen = false, onIntroDismiss }: AffiliateConfigProps) => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { patchConfig, copyVideoFormConfig } = useCopyVideoContext();

  const { ART_STYLE_TRANSLATED_OPTIONS, LANGUAGE_OPTIONS, MOOD_OPTIONS } = useOptionsTranslation();

  const introSteps = useMemo(() => getCopyVideoSidebarIntroSteps(t), [t]);

  return (
    <div className="flex-1 bg-white">
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />

      {/* ── Form Fields ── */}

      <div className="px-4 pt-3 pb-4 space-y-3">
        {/* Upload Video tối đa 50MB*/}

        <div id="copy-video-upload">
        <VideoUploadPicker
          label={t("Upload Video gốc")}
          maxSizeMB={50}
          value={copyVideoFormConfig?.sourceVideo || null}
          onSelect={(result) => {
            if (result) {
              patchConfig && patchConfig({ sourceVideo: result } as any);
            }
          }}
        />
        </div>

        <div id="aspect-ratio-section">
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

        <ArtStylePickerDialog
          name="artStyle"
          value={copyVideoFormConfig?.artStyle}
          onChange={(v) => patchConfig && patchConfig({ artStyle: v })}
          onCodeChange={(code) => patchConfig && patchConfig({ artStyleId: code })}
        />

        {/* NGÔN NGỮ LỜI THOẠI */}

        <div id="language-section">
        <Field noError label={t("Ngôn ngữ lời thoại")}>
          <Select
            native
            id="language-select"
            className="border-gray-200"
            options={LANGUAGE_OPTIONS}
            value={copyVideoFormConfig?.language}
            onChange={(v) => patchConfig && patchConfig({ language: v })}
          />
        </Field>
        </div>

        {/* MOOD / TÍNH CÁCH */}

        <div id="mood-section">
        <Field noError label={t("Tính cách / Mood")}>
          <Select
            native
            id="mood-select"
            className="border-gray-200"
            options={MOOD_OPTIONS}
            value={copyVideoFormConfig?.mood}
            onChange={(v) => patchConfig && patchConfig({ mood: v })}
          />
        </Field>
        </div>
        {/* NHÂN HOÁ ĐỒ VẬT (objectToPersonify) */}
        <div>
          <ObjectPersonifyPickerDialog
            name="objectToPersonify"
            value={copyVideoFormConfig?.objectToPersonify}
            onChange={(v) =>
              patchConfig &&
              patchConfig({
                objectToPersonify: v,
                ...(v?.trim() ? { objectToPersonifyImage: undefined } : {}),
              })
            }
            onCodeChange={(code) => patchConfig && patchConfig({ objectToPersonifyCode: code })}
            imageValue={copyVideoFormConfig?.objectToPersonifyImage}
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
        {/* Ảnh sản phẩm */}

        <div id="product-images-section">
        <Field noError label={t("Ảnh sản phẩm tham chiếu (tùy chọn)")}>
          <ImageInput
            multi
            value={copyVideoFormConfig?.productImages}
            onChange={(v) => patchConfig && patchConfig({ productImages: v })}
            readOnly={!customer}
            limit={5}
          />
        </Field>
        </div>
      </div>
    </div>
  );
};
