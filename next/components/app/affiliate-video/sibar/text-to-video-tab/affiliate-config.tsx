/**
 * affiliate-config.tsx
 * Sidebar form: Tạo Nhân Vật – light theme, cream/white background
 * className only – Tailwind CSS, no inline styles, no arbitrary [] values
 */
import { useTranslation } from "react-i18next";
import { RiCameraLensFill, RiFilmFill, RiLightbulbLine, RiMagicFill } from "react-icons/ri";
import { ASPECT_RATIOS, CATEGORY_OPTIONS, IMAGE_STYLES, LANGUAGE_OPTIONS, TONE_OPTIONS } from "../../constants";
import { useAffiliateVideoContext } from "../../providers/affiliate-video-provider";

// ── Reusable sub-components ──────────────────────────────────────────────

function SectionLabel({ icon, text }: { icon?: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1 mb-1">
      {icon && <span className="text-gray-400 text-xs">{icon}</span>}
      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{text}</span>
    </div>
  );
}

function NativeSelect({
  value,
  onChange,
  options,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  id?: string;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-gray-200 bg-white text-gray-800 text-sm px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors cursor-pointer appearance-none"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  id?: string;
}) {
  return (
    <input
      id={id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-200 bg-white text-gray-800 text-sm px-3 py-2 outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 transition-colors placeholder-gray-400"
    />
  );
}

// ── Main Component ────────────────────────────────────────────────────────

export const AffiliateConfig = () => {
  const { t } = useTranslation();
  const {
    videoConfig,
    patchConfig,
    inputMode,
    setInputMode,
    imageStyle,
    setImageStyle,
    language,
    setLanguage,
    category,
    setCategory,
    tone,
    setTone,
    propItem,
    setPropItem,
    tipContent,
    setTipContent,
    setShowAiModal,
  } = useAffiliateVideoContext();

  const aspectRatios = ASPECT_RATIOS.slice(0, 2); // 16:9 and 9:16

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
          {t("Gợi ý ngẫu nhiên")}
        </button>
      </div>

      {/* ── Mode Toggle: Prompt to Video / Image to Video ── */}
      <div className="px-4 pt-3 pb-2">
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-xl p-1">
          <button
            onClick={() => setInputMode && setInputMode("prompt")}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              inputMode === "prompt"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiFilmFill className={inputMode === "prompt" ? "text-pink-500" : "text-gray-400"} />
            {t("Prompt to Video")}
          </button>
          <button
            onClick={() => setInputMode && setInputMode("image")}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer border-0 ${
              inputMode === "image"
                ? "bg-white text-gray-800 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiCameraLensFill className={inputMode === "image" ? "text-pink-500" : "text-gray-400"} />
            {t("Image to Video")}
          </button>
        </div>
      </div>

      {/* ── Form Fields ── */}
      <div className="px-4 pb-4 space-y-3">

        {/* PHONG CÁCH HÌNH ẢNH */}
        <div>
          <SectionLabel text={t("Phong cách hình ảnh")} />
          <div className="relative">
            <NativeSelect
              id="image-style-select"
              value={imageStyle || IMAGE_STYLES[0].value}
              onChange={(v) => setImageStyle && setImageStyle(v)}
              options={IMAGE_STYLES}
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">
              ▾
            </div>
          </div>
        </div>

        {/* NGÔN NGỮ LỜI THOẠI */}
        <div>
          <SectionLabel text={t("Ngôn ngữ lời thoại")} />
          <div className="relative">
            <NativeSelect
              id="language-select"
              value={language || LANGUAGE_OPTIONS[0].value}
              onChange={(v) => setLanguage && setLanguage(v)}
              options={LANGUAGE_OPTIONS}
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">
              ▾
            </div>
          </div>
        </div>

        {/* TỈ LỆ KHUNG HÌNH */}
        <div>
          <SectionLabel text={t("Tỉ lệ khung hình")} />
          <div className="grid grid-cols-2 gap-2">
            {aspectRatios.map((ar) => {
              const isPortrait = ar.value === "9:16";
              const isActive = videoConfig?.aspectRatio === ar.value;
              return (
                <button
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
                </button>
              );
            })}
          </div>
        </div>

        {/* CHỦ ĐỀ / DANH MỤC */}
        <div>
          <SectionLabel text={t("Chủ đề / Danh mục")} />
          <div className="relative">
            <NativeSelect
              id="category-select"
              value={category || CATEGORY_OPTIONS[0].value}
              onChange={(v) => setCategory && setCategory(v)}
              options={CATEGORY_OPTIONS}
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">
              ▾
            </div>
          </div>
        </div>

        {/* TÍNH CÁCH CHUNG / TONE */}
        <div>
          <SectionLabel text={t("Tính cách chung / Tone")} />
          <div className="relative">
            <NativeSelect
              id="tone-select"
              value={tone || TONE_OPTIONS[0].value}
              onChange={(v) => setTone && setTone(v)}
              options={TONE_OPTIONS}
            />
            <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-gray-400 text-xs">
              ▾
            </div>
          </div>
        </div>

        {/* NHÂN HOÁ ĐỒ VẬT */}
        <div>
          <SectionLabel text={t("Nhân hoá đồ vật")} />
          <TextInput
            id="prop-item-input"
            value={propItem || ""}
            onChange={(v) => setPropItem && setPropItem(v)}
            placeholder={t("VD: Một quả chuối tươi")}
          />
        </div>

        {/* NỘI DUNG MẸO */}
        <div>
          <SectionLabel text={t("Nội dung mẹo")} />
          <TextInput
            id="tip-content-input"
            value={tipContent || ""}
            onChange={(v) => setTipContent && setTipContent(v)}
            placeholder={t("VD: Cách ăn chuối tốt nhất")}
          />
        </div>

        {/* Mẹo nhỏ section */}
        <div className="mt-2 p-3 rounded-xl bg-amber-50 border border-amber-100">
          <div className="flex items-center gap-1 mb-2">
            <RiLightbulbLine className="text-amber-500 text-sm" />
            <span className="text-xs font-bold text-amber-700">{t("Mẹo nhỏ")}</span>
          </div>
          <ul className="space-y-1">
            <li className="text-xs text-amber-700 leading-relaxed">
              • {t("Chủ đề Cốt Truyện: Hãy nhập chi tiết bối cảnh để AI tạo drama hay hơn (VD: Mẹ chồng khó tính, Sắp hết ăm...)")}.
            </li>
            <li className="text-xs text-amber-700 leading-relaxed">
              • {t("Chọn \"Mẹo Vật Cuộc Sống\" cho các tip đon đẹp.")}.
            </li>
            <li className="text-xs text-amber-700 leading-relaxed">
              • {t("Visual Prompt luôn là Tiếng Anh để tối ưu cho AI về ảnh.")}.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};
