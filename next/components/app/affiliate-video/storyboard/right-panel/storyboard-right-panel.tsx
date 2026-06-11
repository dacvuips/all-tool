/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiFileCopyLine, RiMusicFill, RiScissorsLine } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./batch-list";

// ── Audio Voice Config Panel ─────────────────────────────────────────────
function AudioVoicePanel({
  audioConfig,
}: {
  audioConfig: { gender: string; mood: string; style: string; fullPrompt: string };
}) {
  const { t } = useTranslation();
  const [isCopied, setIsCopied] = useState(false);

  /** Copy toàn bộ audio prompt vào clipboard */
  const handleCopyAudioPrompt = () => {
    navigator.clipboard.writeText(audioConfig.fullPrompt);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1500);
  };

  /** Màu tag theo loại */
  const TAG_COLORS: Record<string, string> = {
    Female: "bg-pink-100 text-pink-600 border-pink-200",
    Male: "bg-blue-100 text-blue-600 border-blue-200",
    Energetic: "bg-orange-100 text-orange-600 border-orange-200",
    Casual: "bg-green-100 text-green-600 border-green-200",
    Formal: "bg-purple-100 text-purple-600 border-purple-200",
  };

  const getTagColor = (tag: string) =>
    TAG_COLORS[tag] || "bg-gray-100 text-gray-600 border-gray-200";

  return (
    <div className="h-full">
      {/* Tiêu đề section */}
      <div className="flex items-center gap-1.5 mb-2 text-pink-400">
        <RiMusicFill className="text-sm" />
        <span className="text-xs font-bold tracking-wide uppercase">
          {t("CẤU HÌNH ÂM THANH & GIỌNG NÓI")}
        </span>
      </div>
      {/* Tags: giới tính, mood, phong cách */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {[audioConfig?.gender, audioConfig?.mood, audioConfig?.style].map((tag) => (
          <span
            key={tag}
            className={`text-xs font-semibold px-2.5 py-1 rounded-full border text-yellow-600 bg-yellow-50 ${getTagColor(
              tag
            )}`}
          >
            {tag === audioConfig?.gender && "♀ "}
            {tag === audioConfig?.mood && "⚡ "}
            {tag === audioConfig?.style && "💬 "}
            {tag}
          </span>
        ))}
      </div>
      {/* Full prompt label */}
      <div className="mb-1 text-xs font-semibold">{t("Prompt âm thanh đầy đủ")}</div>
      <p className="mb-2 text-xs leading-relaxed text-gray-600">{audioConfig?.fullPrompt}</p>
      {/* Nút copy */}
      <button
        onClick={handleCopyAudioPrompt}
        className="flex gap-1 items-center text-xs font-semibold text-pink-500 bg-transparent border-0 transition-colors cursor-pointer hover:text-pink-700"
      >
        <RiFileCopyLine className="text-xs" />
        {isCopied ? `✓ ${t("Đã sao chép")}` : t("Sao chép Prompt âm thanh")}
      </button>
    </div>
  );
}

// ── Environment Panel ────────────────────────────────────────────────────
function EnvironmentPanel({
  environment,
}: {
  environment: { environment: string; artStyle: string };
}) {
  const { t } = useTranslation();

  return (
    <div className="h-full">
      {/* Tiêu đề section */}
      <div className="flex items-center gap-1.5 mb-2 text-blue-400">
        <RiScissorsLine className="text-sm" />
        <span className="text-xs font-bold tracking-wide uppercase">
          {t("BỐI CẢNH & PHONG CÁCH")}
        </span>
      </div>
      {/* Bối cảnh */}
      <div className="mb-1 text-xs font-semibold">{t("Bối cảnh")}</div>
      <p className="mb-3 text-xs leading-relaxed text-gray-600 line-clamp-5">
        {environment.environment}
      </p>
      {/* Phong cách nghệ thuật */}
      <div className="mb-1 text-xs font-semibold">{t("Phong cách nghệ thuật")}</div>
      <p className="text-xs italic leading-relaxed text-gray-400 line-clamp-2">
        {environment.artStyle}
      </p>
    </div>
  );
}

// ── Tab index mapping ────────────────────────────────────────────────────
const TAB_NAMES = ["script", "batch"] as const;

// ── Main Right Panel ─────────────────────────────────────────────────────
export const StoryboardRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, scriptTab, setScriptTab, batchList, batchRunning } =
    useAffiliateVideoContext();
  const { customer } = useAuth();
  const tabIndex =
    TAB_NAMES.indexOf(scriptTab as any) >= 0 ? TAB_NAMES.indexOf(scriptTab as any) : 0;

  // Label tab Batch List kèm số lượng scene
  const sceneCount = scriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;

  return (
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={(i) => setScriptTab && setScriptTab(TAB_NAMES[i])}
        name="affiliate-video-right"
        flex={false}
        tabClassName="px-4 py-3"
        titleClassName="text-sm font-semibold whitespace-nowrap"
        bodyClassName="flex-1 overflow-y-auto v-scrollbar"
        className="bg-white"
      >
        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab label={batchTabLabel}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={(scriptData?.scenes || []).map((s, i) => ({
                id: s.id || `scene-${i}`,
                sceneNumber: s.sceneNumber,
                camera: s.camera || "WIDE SHOT",
                imageGenPrompt: s.imageGenPrompt || "",
                motionPrompt: s.motionPrompt || "",
                dialogue: s.dialogue || "",
                visualPrompt: s.visualPrompt || "",
                disabled: s.disabled ?? false,
                voiceDisable: s.voiceDisable ?? false,
                audio: s.audio || "",
                noText: s.noText ?? false,
                product_image_prompt: s.product_image_prompt ?? "",
                selectedProductImages: s.selectedProductImages ?? [],
                cropRegion: s.cropRegion,
                storyboardCropImage: s.storyboardCropImage,
              }))}
              storyModeType={scriptData?.storyModeType}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
