/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 * Field names aligned with AffiliateFormConfig interface.
 */
import { useTranslation } from "react-i18next";
import { RiCameraLensFill, RiMagicFill } from "react-icons/ri";
import { Button, Field } from "../../../shared/utilities/form";
import { Input } from "../../../shared/utilities/form/input";
import { Select } from "../../../shared/utilities/form/select";
import {
  ART_STYLE_OPTIONS,
  ASPECT_RATIOS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  MOOD_OPTIONS,
} from "../constants";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const { videoConfig, patchConfig, setShowAiModal } = useAffiliateVideoContext();
  return (
    <div className="flex-1 overflow-y-auto bg-white">
      {/* ── Header: Tạo Nhân Vật ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-red-500 flex items-center justify-center">
            <RiCameraLensFill className="text-white text-base" />
          </div>
          <span className="text-base font-bold text-gray-800">{t("Tạo Nhân Vật")}</span>
        </div>
        <button
          onClick={() => setShowAiModal && setShowAiModal(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold transition-colors cursor-pointer border-0"
        >
          <RiMagicFill className="text-xs" />
          {t("Gợi ý")}
        </button>
      </div>

      {/* ── Mode Toggle: Prompt to Video / Image to Video ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
          {/* <button
            onClick={() => setStoryModeType && setStoryModeType("prompt_to_video")}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              storyModeType === "prompt_to_video"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiFilmFill
              className={storyModeType === "prompt_to_video" ? "text-pink-500" : "text-gray-400"}
            />
            {t("Prompt to Video")}
          </button>
          <button
            onClick={() => setStoryModeType && setStoryModeType("image_to_video")}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              storyModeType === "image_to_video"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiCameraLensFill
              className={storyModeType === "image_to_video" ? "text-pink-500" : "text-gray-400"}
            />
            {t("Image to Video")}
          </button> */}
        </div>
      </div>

      {/* ── Form Fields ── */}

      <div className="px-4 pb-4 space-y-3">
        {/* TỈ LỆ KHUNG HÌNH */}
        <div>
          <Field name="aspectRatio" label={t("Tỉ lệ khung hình")}>
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
                    <span className="text-base">{isPortrait ? "📱" : "🖥"}</span>
                    {isPortrait ? `${ar.value} ${t("Dọc")}` : `${ar.value} ${t("Ngang")}`}
                  </Button>
                );
              })}
            </div>
          </Field>
        </div>
        {/* ART STYLE */}
        <div>
          <Field name="artStyle" label={t("Phong cách hình ảnh")}>
            <Select id="art-style-select" native options={ART_STYLE_OPTIONS} />
          </Field>
        </div>

        {/* NGÔN NGỮ LỜI THOẠI */}
        <div>
          <Field name="language" label={t("Ngôn ngữ lời thoại")}>
            <Select id="language-select" native options={LANGUAGE_OPTIONS} />
          </Field>
        </div>

        {/* CHỦ ĐỀ / DANH MỤC */}
        <div>
          <Field name="category" label={t("Chủ đề / Danh mục")}>
            <Select id="category-select" native options={CATEGORY_OPTIONS} />
          </Field>
        </div>

        {/* MOOD / TÍNH CÁCH */}
        <div>
          <Field name="mood" label={t("Tính cách / Mood")}>
            <Select id="mood-select" native options={MOOD_OPTIONS} />
          </Field>
        </div>

        {/* NHÂN HOÁ ĐỒ VẬT (objectToPersonify) */}
        <div>
          <Field name="objectToPersonify" label={t("Nhân hoá đồ vật")}>
            <Input id="object-to-personify-input" placeholder={t("VD: Một quả chuối tươi")} />
          </Field>
        </div>

        {/* NỘI DUNG MẸO (tipContent) */}
        <div>
          <Field name="tipContent" label={t("Nội dung mẹo")}>
            <Input id="tip-content-input" placeholder={t("VD: Cách ăn chuối tốt nhất")} />
          </Field>
        </div>

        {/* SỐ LƯỢNG VIDEO (batchSize) */}
        <div>
          <Field name="batchSize" label={t("Số lượng video")}>
            <Select
              id="batch-size-select"
              native
              options={[1, 2, 3, 4, 5].map((n) => ({ value: String(n), label: String(n) }))}
              value={String(videoConfig?.batchSize ?? 1)}
              onChange={(v) => patchConfig && patchConfig({ batchSize: Number(v) })}
            />
          </Field>
        </div>
      </div>
    </div>
  );
};
