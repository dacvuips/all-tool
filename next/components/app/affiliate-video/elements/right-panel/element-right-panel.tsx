/**
 * affiliate-video-right-panel.tsx
 * Right panel: Tab Kịch Bản (Script) / Tab Batch List
 * - i18n: tất cả text bọc trong t()
 * - Responsive: grid stack trên mobile
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { RiDeleteBinLine, RiHistoryLine } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";
import { CopyVideoAnalysisData } from "../../constants";
import { useElementContext } from "../providers/element-provider";
import { AiGeneratingSpinner } from "./ai-generating-spinner";
import { BatchListPanel } from "./batch-list";
import { CastSection } from "./cast-section";
import { SceneCard } from "./scene-card";

/** Tab JSX order: 0 = Danh sách hàng loạt, 1 = Kịch Bản (must match onChange mapping below) */
const scriptTabToIndex = (tab: "script" | "batch" | undefined): number => {
  if (tab === "script") return 1;
  return 0; // "batch" or unknown → batch list tab
};
const indexToScriptTab = (index: number): "script" | "batch" => (index === 1 ? "script" : "batch");

// ── Main Right Panel ─────────────────────────────────────────────────────
export const ElementRightPanel = () => {
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
  } = useElementContext();
  const { customer } = useAuth();
  const [confirmClear, setConfirmClear] = useState(false);
  const tabIndex = scriptTabToIndex(scriptTab);

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
        <div className="flex gap-1 items-center">
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
    <div className="flex overflow-hidden flex-col flex-1">
      <TabGroup
        index={tabIndex}
        onChange={(i) => setScriptTab?.(indexToScriptTab(i))}
        name="element-video-right"
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
        {/* ── Tab: Kịch Bản (Script) ── */}
        <TabGroup.Tab label={t("Kịch Bản")}>
          {!customer ? (
            <div className="flex flex-col justify-center items-center py-16">
              <span className="text-sm font-medium text-gray-400">
                {t("Vui lòng đăng nhập để sử dụng tính năng này")}
              </span>
            </div>
          ) : batchRunning ? (
            <AiGeneratingSpinner />
          ) : !scriptData ? (
            /* Trạng thái trống */
            <div className="flex flex-col justify-center items-center py-16 h-full text-gray-400">
              <div className="mb-4 text-5xl opacity-30">📋</div>
              <div className="mb-1 text-base font-medium text-gray-500">
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
                  <div className="flex justify-between items-center w-full sm:w-auto">
                    <div className="flex items-center gap-1.5 text-indigo-500">
                      <RiHistoryLine className="text-sm" />
                      <span className="text-xs font-semibold whitespace-nowrap">
                        {t("Lịch sử")}
                      </span>
                    </div>
                    {/* Action buttons (Delete) on mobile */}
                    <div className="flex gap-1 items-center sm:hidden">
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
                  <div className="hidden gap-1 items-center sm:flex">{renderHistoryActions()}</div>
                </div>
              )}
              {/* Phần nhân vật */}
              <CastSection scriptData={scriptData as CopyVideoAnalysisData} />

              {/* Phần danh sách cảnh */}
              <div className="mb-3">
                <h3 className="mb-3 text-base font-bold text-gray-800">
                  📽 {t("Phân Cảnh & Prompt")}
                </h3>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {scriptData?.scenes?.map((scene, i) => (
                    <SceneCard
                      key={scene.id || `scene-${i}`}
                      scene={{
                        id: `scene-${i}`,
                        sceneNumber: i + 1,
                        camera: "WIDE SHOT",
                        imageGenPrompt: scene.visual_prompt || "",
                        motionPrompt: scene.motion_description || "",
                        dialogue: `${scene.original_content}\n ${scene.translated_content}` || "",
                        visualPrompt: scene.visual_prompt || "",
                      }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </TabGroup.Tab>
      </TabGroup>
    </div>
  );
};
