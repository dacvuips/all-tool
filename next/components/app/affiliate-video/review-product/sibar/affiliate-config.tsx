/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useTranslation } from "react-i18next";
import { BsFile } from "react-icons/bs";

import { useQueryParams } from "../../../../../lib/hooks/useQueryParams";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { Button, Field, Radio, Textarea } from "../../../../shared/utilities/form";
import { ASPECT_RATIOS } from "../../constants";
import { ArtStylePickerDialog } from "../../shared/art-style-picker-dialog";

import { REVIEW_SCRIPT_TAB_QUERY_KEY, ReviewScriptTabEnum, ServiceImageEnum } from "../constants";
import { useReviewContext } from "../providers/review-provider";
import { ReviewImagesUpload, ReviewVideoUpload } from "./review-images-upload";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { patchConfig, reviewFormConfig } = useReviewContext();
  const [queryParams, setQueryParams] = useQueryParams({
    [REVIEW_SCRIPT_TAB_QUERY_KEY]: "",
  });
  const reviewParam = queryParams[REVIEW_SCRIPT_TAB_QUERY_KEY] as string | undefined;

  const isImagesToVideo = reviewParam === ReviewScriptTabEnum.imagesToVideo;
  const isVideoToVideo = reviewParam === ReviewScriptTabEnum.videoToVideo;
  return (
    <div className="flex-1 bg-white">
      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
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
        <div>
          <ArtStylePickerDialog
            name="artStyle"
            value={reviewFormConfig?.artStyle}
            onChange={(v) => patchConfig && patchConfig({ artStyle: v })}
            onCodeChange={(code) => patchConfig && patchConfig({ artStyleId: code })}
          />
        </div>

        <Field noError label={t("Prompt phân cảnh")}>
          <Textarea
            id="scene-prompt-list"
            className="border-gray-200 min-h-[200px]"
            maxRows={10}
            placeholder={`${t("Mỗi dòng bắt đầu bằng số là một cảnh, ví dụ")}:\n${t("1")}. ${t(
              "Mô tả cảnh đầu"
            )}...\n${t("2")}. ${t("Mô tả cảnh hai")}...\n${t("3")}. ${t("Mô tả cảnh ba")}...`}
            value={reviewFormConfig?.prompt}
            onChange={(v) => patchConfig && patchConfig({ prompt: v })}
          />
        </Field>
        {/* Option cho Images to Video*/}
        {isImagesToVideo && (
          <Field label={t("Chế độ nạp ảnh")}>
            <Radio
              defaultValue={ServiceImageEnum.imageOnly}
              selectFirst
              cols={12}
              value={reviewFormConfig.serviceImageType}
              onChange={(val) => patchConfig && patchConfig({ serviceImageType: val })}
              options={[
                { label: t("Chỉ có ảnh bắt đầu -> Video"), value: ServiceImageEnum.imageOnly },
                { label: t("Ảnh bắt đầu và kết thúc -> Video"), value: ServiceImageEnum.startEnd },
                { label: t("2 ảnh kết hợp -> Video"), value: ServiceImageEnum.startAddEnd },
              ]}
            />
          </Field>
        )}
        {isVideoToVideo && (
          <ReviewVideoUpload
            videoRef={reviewFormConfig?.videoRef}
            readOnly={!customer}
            onVideoRefChange={(v) => patchConfig && patchConfig({ videoRef: v })}
          />
        )}
        {/* Ảnh sản phẩm */}
        <ReviewImagesUpload
          artStyleImg={reviewFormConfig?.artStyleImg}
          readOnly={!customer}
          onArtStyleImgChange={(v) => patchConfig && patchConfig({ artStyleImg: v })}
        />
      </div>
    </div>
  );
};
