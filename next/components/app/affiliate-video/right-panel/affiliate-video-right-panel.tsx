/**
 * affiliate-video-right-panel.tsx
 * Right panel: Kịch Bản tab / Batch List tab
 * Light theme – className only, Tailwind CSS
 */
import { useState } from "react";
import { RiFileCopyLine, RiListCheck2, RiMusicFill, RiScissorsLine } from "react-icons/ri";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";
import { BatchListPanel } from "./batch-list";
import { CastSection } from "./cast-section";
import { SceneCard } from "./scene-card";

// ── Audio Voice Config ───────────────────────────────────────────────────
function AudioVoicePanel({
  audioConfig,
}: {
  audioConfig: { gender: string; mood: string; style: string; fullPrompt: string };
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(audioConfig.fullPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const TAG_COLORS = {
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
      <div className="flex items-center gap-1.5 mb-2 text-pink-400">
        <RiMusicFill className=" text-sm" />
        <span className="text-xs font-bold   uppercase tracking-wide">AUDIO & VOICE CONFIG</span>
      </div>
      {/* Tags */}
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
      <div className="text-xs font-semibold  mb-1">Full Audio Prompt</div>
      <p className="text-xs text-gray-600 leading-relaxed mb-2">{audioConfig?.fullPrompt}</p>
      {/* Copy button */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-1 text-xs font-semibold text-pink-500 hover:text-pink-700 cursor-pointer border-0 bg-transparent transition-colors"
      >
        <RiFileCopyLine className="text-xs" />
        {copied ? "✓ Đã copy" : "Copy Full Audio Prompt"}
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
  return (
    <div className="h-full">
      <div className="flex items-center gap-1.5 mb-2 text-blue-400">
        <RiScissorsLine className="t text-sm" />
        <span className="text-xs font-bold  uppercase tracking-wide">ENVIRONMENT & STYLE</span>
      </div>
      <div className="text-xs font-semibold mb-1">Environment (Bối cảnh)</div>
      <p className="text-xs text-gray-600 leading-relaxed mb-3 line-clamp-5">
        {environment.environment}
      </p>
      <div className="text-xs font-semibold mb-1">Art Style (3D CGI)</div>
      <p className="text-xs text-gray-400 leading-relaxed line-clamp-2 italic">
        {environment.artStyle}
      </p>
    </div>
  );
}

// ── Main Right Panel ─────────────────────────────────────────────────────
export const AffiliateVideoRightPanel = () => {
  const { scriptData, scriptTab, setScriptTab, batchList } = useAffiliateVideoContext();

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-amber-50">
      {/* ── Tab bar ── */}
      <div className="flex items-center px-4 border-b border-gray-200 bg-white flex-shrink-0">
        <div className="flex gap-0">
          {/* Kịch Bản tab */}
          <button
            id="tab-script"
            onClick={() => setScriptTab && setScriptTab("script")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer border-0 bg-transparent ${
              scriptTab === "script"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            📋 {"Kịch Bản"}
          </button>

          {/* Batch List tab */}
          <button
            id="tab-batch"
            onClick={() => setScriptTab && setScriptTab("batch")}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-semibold border-b-2 transition-colors cursor-pointer border-0 bg-transparent ${
              scriptTab === "batch"
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <RiListCheck2 className="text-sm" />
            {"Batch List"} {batchList && batchList.length > 0 && `(${batchList.length})`}
          </button>
        </div>
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto v-scrollbar  ">
        {scriptTab === "batch" ? (
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
            }))}
            characters={[]}
          />
        ) : !scriptData ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
            <div className="text-5xl mb-4 opacity-30">📋</div>
            <div className="text-base font-medium text-gray-500 mb-1">Chưa có kịch bản</div>
            <div className="text-sm text-gray-400">
              Điền thông tin sidebar và nhấn "Tạo Ảnh & Phim"
            </div>
          </div>
        ) : (
          <div className="px-4 py-4">
            {/* Cast Section */}
            <CastSection scriptData={scriptData} />

            {/* Environment & Audio – 2 columns */}
            <div className="grid grid-cols-2 gap-4 mb-4">
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

            {/* Scenes Section */}
            <div className="mb-3">
              <h3 className="text-base font-bold text-gray-800 mb-3">
                📽 Phân Cảnh & Prompt (Scenes)
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
      </div>
    </div>
  );
};
