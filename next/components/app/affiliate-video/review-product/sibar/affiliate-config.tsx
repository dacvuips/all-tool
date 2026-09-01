/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useTranslation } from "react-i18next";
import { useMemo } from "react";

import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, Select, Textarea } from "../../../../shared/utilities/form";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";
import { AspectRatioPicker } from "../../shared/aspect-ratio-picker";
import { AffiliateSidebarIntro } from "../../shared/affiliate-sidebar-intro";
import { getReviewSidebarIntroSteps } from "../../shared/affiliate-sidebar-intro-steps";

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
      <AffiliateSidebarIntro
        isOpen={introOpen}
        steps={introSteps}
        onDismiss={onIntroDismiss ?? (() => {})}
      />
    <div className="flex-1 bg-white">
      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
        <div id="aspect-ratio-section">
        <Field noError name="aspectRatio" label={t("Tỉ lệ khung hình")}>
          <AspectRatioPicker
            value={reviewFormConfig?.aspectRatio}
            onChange={(aspectRatio) => patchConfig && patchConfig({ aspectRatio })}
          />
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
