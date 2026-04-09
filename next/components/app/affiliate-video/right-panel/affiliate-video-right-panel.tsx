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
import { TabGroup } from "../../../shared/utilities/tab/tab-group";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./batch-list";
import { CastSection } from "./cast-section";
import { SceneCard } from "./scene-card";

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
        <span className="text-xs font-bold uppercase tracking-wide">
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
      <div className="text-xs font-semibold mb-1">{t("Prompt âm thanh đầy đủ")}</div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2">{audioConfig?.fullPrompt}</p>
      {/* Nút copy */}
      <button
        onClick={handleCopyAudioPrompt}
        className="flex items-center gap-1 text-xs font-semibold text-pink-500 hover:text-pink-700 cursor-pointer border-0 bg-transparent transition-colors"
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
        <span className="text-xs font-bold uppercase tracking-wide">
          {t("BỐI CẢNH & PHONG CÁCH")}
        </span>
      </div>
      {/* Bối cảnh */}
      <div className="text-xs font-semibold mb-1">{t("Bối cảnh")}</div>
      <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-5">
        {environment.environment}
      </p>
      {/* Phong cách nghệ thuật */}
      <div className="text-xs font-semibold mb-1">{t("Phong cách nghệ thuật")}</div>
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 italic">
        {environment.artStyle}
      </p>
    </div>
  );
}

// ── Tab index mapping ────────────────────────────────────────────────────
const TAB_NAMES = ["script", "batch"] as const;

// ── Main Right Panel ─────────────────────────────────────────────────────
export const AffiliateVideoRightPanel = () => {
  const { t } = useTranslation();
  const { scriptData, scriptTab, setScriptTab, batchList, batchRunning } =
    useAffiliateVideoContext();

  const tabIndex =
    TAB_NAMES.indexOf(scriptTab as any) >= 0 ? TAB_NAMES.indexOf(scriptTab as any) : 0;

  // Label tab Batch List kèm số lượng
  const batchTabLabel = `${t("Danh sách hàng loạt")}${
    batchList && batchList.length > 0 ? ` (${batchList.length})` : ""
  }`;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
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
        {/* ── Tab: Kịch Bản (Script) ── */}
        <TabGroup.Tab label={t("Kịch Bản")}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : !scriptData ? (
            /* Trạng thái trống */
            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
              <div className="text-5xl mb-4 opacity-30">📋</div>
              <div className="text-base font-medium text-gray-500 mb-1">
                {t("Chưa có kịch bản")}
              </div>
              <div className="text-sm text-gray-400">
                {t("Điền thông tin sidebar và nhấn 'Tạo Ảnh & Phim'")}
              </div>
            </div>
          ) : (
            <div className="px-4 py-4">
              {/* Phần nhân vật */}
              <CastSection scriptData={scriptData} />

              {/* Bối cảnh & Âm thanh – responsive grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <EnvironmentPanel
                    environment={{
                      environment: scriptData.environment,
                      artStyle: scriptData.artStyle,
                    }}
                  />
                </div>
                <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
                  <AudioVoicePanel
                    audioConfig={{
                      gender: scriptData.voiceGender,
                      mood: scriptData.voiceTone,
                      style: scriptData.voiceStyle,
                      fullPrompt: `${scriptData.voiceGender} · ${scriptData.voiceTone} · ${scriptData.voiceStyle}`,
                    }}
                  />
                </div>
              </div>

              {/* Phần danh sách cảnh */}
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-800 mb-3">
                  📽 {t("Phân Cảnh & Prompt")}
                </h3>
                {scriptData.scenes.map((scene, i) => (
                  <SceneCard
                    key={scene.sceneNumber ?? i}
                    scene={{
                      id: `scene-${i}`,
                      sceneNumber: scene.sceneNumber,
                      camera: (scene.camera as any) || "WIDE SHOT",
                      imageGenPrompt: scene.imageGenPrompt,
                      motionPrompt: scene.motionPrompt || "",
                      dialogue: scene.dialogue || "",
                      visualPrompt: scene.visualPrompt || "",
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </TabGroup.Tab>

        {/* ── Tab: Batch List (Danh sách hàng loạt) ── */}
        <TabGroup.Tab label={batchTabLabel}>
          {batchRunning ? (
            <AiGeneratingSpinner />
          ) : (
            <BatchListPanel
              scenes={(scriptData?.scenes || []).map((s, i) => ({
                id: (s as any).id || `scene-${i}`,
                sceneNumber: s.sceneNumber,
                camera: (s.camera as any) || "WIDE SHOT",
                imageGenPrompt: s.imageGenPrompt || "",
                motionPrompt: s.motionPrompt || "",
                dialogue: s.dialogue || "",
                visualPrompt: s.visualPrompt || "",
                disabled: (s as any).disabled ?? false,
                audio: s.audio || "",
              }))}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
