/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiDeleteBinLine,
  RiFileCopyLine,
  RiHistoryLine,
  RiMusicFill,
  RiScissorsLine,
} from "react-icons/ri";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { useCopyVideoContext } from "../providers/copy-video-provider";
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
export const CopyVideoRightPanel = () => {
  const { t } = useTranslation();
  const {
    scriptData,
    scriptTab,
    setScriptTab,
    batchRunning,
    sceneHistory,
    selectedHistoryId,
    selectHistoryItem,
    clearSceneHistory,
  } = useCopyVideoContext();

  const [confirmClear, setConfirmClear] = useState(false);
  const tabIndex =
    TAB_NAMES.indexOf(scriptTab as any) >= 0 ? TAB_NAMES.indexOf(scriptTab as any) : 0;

  // Label tab Batch List kèm số lượng scene
  const sceneCount = scriptData?.scenes?.length ?? 0;
  const batchTabLabel = `${t("Danh sách hàng loạt")}${sceneCount > 0 ? ` (${sceneCount})` : ""}`;

  const renderHistoryActions = () => (
    <>
      <span className="text-[10px] text-gray-400 whitespace-nowrap mr-1">
        {sceneHistory.length} {t("bản")}
      </span>
      {!confirmClear ? (
        <button
          onClick={() => setConfirmClear(true)}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all cursor-pointer border-0 bg-transparent"
          title={t("Xóa lịch sử")}
        >
          <RiDeleteBinLine className="text-sm" />
        </button>
      ) : (
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              if (clearSceneHistory) await clearSceneHistory();
              setConfirmClear(false);
            }}
            className="text-[10px] font-semibold text-white bg-red-500 hover:bg-red-600 px-2 py-1 rounded-md cursor-pointer border-0 transition-colors"
          >
            {t("Xóa hết")}
          </button>
          <button
            onClick={() => setConfirmClear(false)}
            className="text-[10px] font-semibold text-gray-500 hover:text-gray-700 px-2 py-1 rounded-md cursor-pointer border-0 bg-transparent transition-colors"
          >
            {t("Hủy")}
          </button>
        </div>
      )}
    </>
  );

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
              {/* ══ HISTORY DROPDOWN ══ */}
              {sceneHistory && sceneHistory.length > 0 && (
                <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50/50 p-2.5 sm:p-0 sm:bg-transparent rounded-xl border border-gray-100 sm:border-none">
                  <div className="flex items-center justify-between w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 text-indigo-500">
                      <RiHistoryLine className="text-sm" />
                      <span className="text-xs font-semibold whitespace-nowrap">
                        {t("Lịch sử")}
                      </span>
                    </div>
                    {/* Action buttons (Delete) on mobile */}
                    <div className="flex items-center gap-1 sm:hidden">
                      {renderHistoryActions()}
                    </div>
                  </div>

                  <select
                    value={selectedHistoryId || sceneHistory[0]?.id || ""}
                    onChange={(e) => selectHistoryItem && selectHistoryItem(e.target.value)}
                    className="w-full sm:flex-1 text-xs bg-white border border-gray-200 rounded-lg px-2.5 py-2 sm:py-1.5 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400 transition-all cursor-pointer hover:border-gray-300 appearance-none shadow-sm sm:shadow-none"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 5l3 3 3-3'/%3E%3C/svg%3E")`,
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "right 8px center",
                      paddingRight: "24px",
                    }}
                  >
                    {sceneHistory.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                        {` (${item.data?.scenes?.length || 0} scenes)`}
                      </option>
                    ))}
                  </select>

                  {/* Action buttons (Delete) on Desktop */}
                  <div className="hidden sm:flex items-center gap-1">{renderHistoryActions()}</div>
                </div>
              )}
              {/* Phần nhân vật */}
              <CastSection scriptData={scriptData} />

              {/* Phần danh sách cảnh */}
              <div className="mb-3">
                <h3 className="text-base font-bold text-gray-800 mb-3">
                  📽 {t("Phân Cảnh & Prompt")}
                </h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {scriptData?.scenes?.map((scene, i) => (
                    <SceneCard
                      key={scene.id || `scene-${i}`}
                      scene={{
                        id: `scene-${i}`,
                        sceneNumber: i + 1,
                        camera: "WIDE SHOT",
                        imageGenPrompt: scene.visual_prompt || "",
                        motionPrompt: scene.motion_description || "",
                        dialogue: scene.original_content || "",
                        visualPrompt: scene.visual_prompt || "",
                      }}
                    />
                  ))}
                </div>
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
                ...s,
                id: s.id || `scene-${i}`,
                sceneNumber: i + 1,
                disabled: s.disabled ?? false,
                voiceDisable: s.voiceDisable ?? false,
              }))}
              characters={[]}
            />
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
