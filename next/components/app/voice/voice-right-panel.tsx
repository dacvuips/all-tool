import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiArrowLeftSLine, RiArrowRightSLine, RiLoader4Line } from "react-icons/ri";
import { jobIdOf } from "./voice-api";
import { CutVideoResults } from "./voice-cut-panel";
import { VoiceJobResult } from "./voice-job-result";
import { MyVoicesPanel } from "./voice-my-voices";
import { useVoiceContext } from "./voice-provider";
import { VoicesBrowsePanel } from "./voice-tools";
import { getVoiceTool, VOICE_TOOLS } from "./voice-tools-config";

function VoiceToolTabs() {
  const { t } = useTranslation();
  const { tool, setTool } = useVoiceContext();
  const tabRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const checkArrow = () => {
    const el = tabRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 32);
    setShowRight(el.scrollWidth - (el.scrollLeft + el.offsetWidth) > 32);
  };

  useEffect(() => {
    checkArrow();
    const el = tabRef.current;
    if (!el) return;
    const onWin = () => checkArrow();
    el.addEventListener("scroll", checkArrow);
    window.addEventListener("resize", onWin);
    return () => {
      el.removeEventListener("scroll", checkArrow);
      window.removeEventListener("resize", onWin);
    };
  }, []);

  useEffect(() => {
    const node = tabRef.current?.querySelector<HTMLElement>(`[data-voice-tab="${tool}"]`);
    node?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
    checkArrow();
  }, [tool]);

  const scrollByPage = (dir: -1 | 1) => {
    const el = tabRef.current;
    if (!el) return;
    el.scrollTo({ left: el.scrollLeft + (dir * el.scrollWidth) / 4, behavior: "smooth" });
  };

  return (
    <div className="overflow-hidden relative flex-shrink-0 w-full min-w-0 bg-white border-b border-gray-200">
      <button
        type="button"
        aria-label={t("Trước")}
        onClick={() => scrollByPage(-1)}
        className="flex absolute left-0 z-10 justify-center items-center w-7 h-full bg-white rounded-none border-0 border-r border-gray-100"
        style={{
          opacity: showLeft ? 1 : 0,
          pointerEvents: showLeft ? "auto" : "none",
          boxShadow: "4px 0 8px -1px rgba(0, 0, 0, 0.1), 2px 0 6px -1px rgba(0, 0, 0, 0.06)",
        }}
      >
        <RiArrowLeftSLine className="text-2xl text-gray-600" />
      </button>
      <button
        type="button"
        aria-label={t("Sau")}
        onClick={() => scrollByPage(1)}
        className="flex absolute right-0 z-10 justify-center items-center w-7 h-full bg-white rounded-none border-0 border-l border-gray-100"
        style={{
          opacity: showRight ? 1 : 0,
          pointerEvents: showRight ? "auto" : "none",
          boxShadow: "-4px 0 8px -1px rgba(0, 0, 0, 0.1), -2px 0 6px -1px rgba(0, 0, 0, 0.06)",
        }}
      >
        <RiArrowRightSLine className="text-2xl text-gray-600" />
      </button>
      <div
        ref={tabRef}
        className="flex overflow-x-auto items-center px-4 h-12 min-w-0 no-scrollbar"
      >
        {VOICE_TOOLS.map((item) => {
          const selected = tool === item.id;
          return (
            <button
              key={item.id}
              type="button"
              data-voice-tab={item.id}
              onClick={() => setTool(item.id)}
              className="flex flex-shrink-0 gap-1.5 items-center px-3 py-2.5 bg-transparent border-0"
              style={{
                color: item.color,
                background: selected ? `${item.color}12` : "transparent",
              }}
            >
              <item.Icon className="flex-shrink-0 text-base" style={{ color: item.color }} />
              <span className="text-xs font-bold whitespace-nowrap">{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function VoiceRightPanel() {
  const { t } = useTranslation();
  const { tool, job, running, history, removeHistory, cancelRun } = useVoiceContext();
  const active = getVoiceTool(tool);
  const Icon = active.Icon;
  const currentJobId = jobIdOf(job);
  const currentRecord = history.find((item) => item.jobId === currentJobId);
  const olderHistory = history.filter((item) => item.jobId !== currentJobId);

  return (
    <div className="flex overflow-hidden flex-col flex-1 min-w-0 w-full h-full bg-amber-50/40">
      <VoiceToolTabs />
      <div className="flex flex-shrink-0 gap-2 items-center px-4 py-1.5 bg-white border-b border-gray-200">
        <div
          className="flex justify-center items-center w-8 h-8 rounded-full"
          style={{ background: `${active.color}22` }}
        >
          <Icon className="text-lg" style={{ color: active.color }} />
        </div>
        <div>
          <h2 className="text-sm font-bold text-slate-800">{t(active.resultTitleKey)}</h2>
          <p className="text-xs text-slate-500">{t(active.resultDescKey)}</p>
        </div>
      </div>
      <div className="overflow-y-auto flex-1 p-4 v-scrollbar">
        {tool === "voices" ? (
          <VoicesBrowsePanel />
        ) : tool === "mine" ? (
          <MyVoicesPanel
            showToolTag
            heading={t("Tất cả giọng đã tạo")}
            emptyText={t("Chưa có giọng tự tạo. Chạy TTS, Clone, Chuyển giọng hoặc Lọc tạp âm để lưu vào đây.")}
          />
        ) : tool === "cut" ? (
          <CutVideoResults />
        ) : (
          <>
            {running && (
              <div
                className="flex gap-2 items-center px-3 py-2 mb-4 text-sm rounded-xl border"
                style={{
                  color: active.color,
                  background: `${active.color}14`,
                  borderColor: `${active.color}55`,
                }}
              >
                <RiLoader4Line className="text-lg animate-spin" style={{ color: active.color }} />
                <span className="flex-1">{t("Đang xử lý job...")}</span>
                <button
                  type="button"
                  onClick={cancelRun}
                  className="flex-shrink-0 px-2.5 h-7 text-xs font-semibold text-white bg-gray-700 rounded-lg border-0"
                >
                  {t("Dừng")}
                </button>
              </div>
            )}
            {tool === "stt" ? (
              !job && !running && history.length === 0 ? (
                <div className="flex flex-col justify-center items-center px-6 py-20 text-center bg-white p-2 rounded-md">
                  <div
                    className="flex justify-center items-center mb-4 w-16 h-16 rounded-2xl border shadow-sm"
                    style={{
                      color: active.color,
                      background: `${active.color}14`,
                      borderColor: `${active.color}33`,
                    }}
                  >
                    <Icon className="text-3xl" style={{ color: active.color }} />
                  </div>
                  <p className="text-base font-semibold text-slate-700">{t("Chưa có kết quả")}</p>
                  <p className="mt-1 max-w-sm text-sm text-slate-500">
                    {t("Điền form bên trái rồi chạy. Kết quả được lưu trên máy.")}
                  </p>
                </div>
              ) : (
                <div className="space-y-4 bg-white p-2 rounded-md">
                  {job || running || currentRecord ? (
                    <VoiceJobResult
                      job={currentRecord?.job || job}
                      record={currentRecord}
                      loading={running && !currentRecord?.blobs?.length}
                      onDelete={currentRecord ? (id) => void removeHistory(id) : undefined}
                    />
                  ) : null}
                  {olderHistory.map((item) => (
                    <VoiceJobResult
                      key={item.id}
                      record={item}
                      job={item.job}
                      onDelete={(id) => void removeHistory(id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-4">
                {running ? (
                  <div className="bg-white p-2 rounded-md">
                    <VoiceJobResult
                      job={currentRecord?.job || job}
                      record={currentRecord}
                      loading={!currentRecord?.blobs?.length}
                      onDelete={currentRecord ? (id) => void removeHistory(id) : undefined}
                    />
                  </div>
                ) : null}
                <MyVoicesPanel
                  records={history}
                  heading={t(active.resultTitleKey)}
                  emptyText={t("Chưa có kết quả ở tab này. Chạy form bên trái để lưu vào đây.")}
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
