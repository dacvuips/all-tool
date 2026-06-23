/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";
import { useMemo } from "react";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, Select, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS } from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { AffiliateIntroStep } from "../../shared/affiliate-intro-step";
import { getReviewSidebarIntroSteps } from "../../shared/affiliate-intro-steps";

import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { ObjectPersonifyPickerDialog } from "../../shared/object-personify-picker-dialog";
import { useReviewContext } from "../providers/review-provider";
import { BatchSizeSlider } from "./batch-size-slider";
import { ReviewImagesUpload } from "./review-images-upload";

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
  const { patchConfig, reviewFormConfig } = useReviewContext();
  const { LANGUAGE_OPTIONS } = useOptionsTranslation();
  const introSteps = useMemo(() => getReviewSidebarIntroSteps(t), [t]);

  return (
    <>
      <AffiliateIntroStep
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
    <div className="flex-1 bg-white">
      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
        <div id="aspect-ratio-section">
        <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
          <div className="grid grid-cols-2 gap-2">
            {ASPECT_RATIOS.map((ar) => {
              const isPortrait = ar.value === "9:16";
              const isActive = reviewFormConfig?.aspectRatio === ar.value;
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
                    {isPortrait ? <BsFile /> : <BsFile style={{ transform: "rotate(90deg)" }} />}
                  </span>
                  {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                </Button>
              );
            })}
          </div>
        </Field>
        </div>
        <div>
          <ArtStylePickerDialog
            name="artStyle"
            value={reviewFormConfig?.artStyle}
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
        <ObjectPersonifyPickerDialog
          name="objectToPersonify"
          value={reviewFormConfig?.objectToPersonify}
          onChange={(v) =>
            patchConfig &&
            patchConfig({
              objectToPersonify: v,
              ...(v?.trim() ? { objectToPersonifyImage: undefined } : {}),
            })
          }
          onCodeChange={(code) => patchConfig && patchConfig({ objectToPersonifyCode: code })}
          imageValue={reviewFormConfig?.objectToPersonifyImage}
          onImageChange={(v) =>
            patchConfig &&
            patchConfig({
              objectToPersonifyImage: v,
              ...(v?.imageBytes ? { objectToPersonify: "", objectToPersonifyCode: undefined } : {}),
            })
          }
          readOnly={!customer}
        />
        {/* Ảnh sản phẩm */}
        <div id="review-images-upload">
        <ReviewImagesUpload
          artStyleImg={reviewFormConfig?.artStyleImg}
          readOnly={!customer}
          onArtStyleImgChange={(v) => patchConfig && patchConfig({ artStyleImg: v })}
        />
        </div>
        <div id="scene-prompt-section">
        <Field noError label={t("Đặt điểm nổi bật của sản phẩm")}>
          <Textarea
            id="scene-prompt-list"
            className="border-gray-200 min-h-[200px]"
            maxRows={10}
            placeholder={`${t("Nhập điểm chính của sản phẩm")}...`}
            value={reviewFormConfig?.prompt}
            onChange={(v) => patchConfig && patchConfig({ prompt: v })}
          />
        </Field>
        </div>
        {/* SỐ LƯỢNG PHÂN CẢNH CẦN TẠO (batchSize) */}
        <BatchSizeSlider
          value={reviewFormConfig?.batchSize ?? 8}
          onChange={(v) => {
            if (patchConfig) patchConfig({ batchSize: v });
          }}
        />
      </div>
    </div>
    </>
  );
};
