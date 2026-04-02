import { useState } from "react";
import { Button } from "../../../shared/utilities/form";
import { MOCK_VIDEOS, PromptItem } from "../constants";
import { useAffiliateVideoContext } from "../providers/affiliate-video-provider";

export const AffiliateVideoRightPanel = () => {
  const {
    activeTab,
    setActiveTab,
    genCount,
    histCount,
    setShowSettings,
    searchQuery,
    setSearchQuery,
    videoConfig,
    speed,
    displayItems,
    useMock,
    totalCount,
    setZoomSrc,
  } = useAffiliateVideoContext();
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Tab bar */}
      <div
        className="flex items-center px-4 h-10 border-b border-white border-opacity-8 flex-shrink-0"
        style={{ background: "#09091a", borderColor: "rgba(255,255,255,0.07)" }}
      >
        <div className="flex gap-1 mr-auto">
          <Button
            onClick={() => setActiveTab("generating")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
              activeTab === "generating"
                ? "bg-indigo-600 text-white"
                : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
            }`}
          >
            ⏳ Generating
            {genCount > 0 && (
              <span className="text-9 font-bold px-1 rounded-full bg-white bg-opacity-20">
                {genCount}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setActiveTab("history")}
            className={`flex items-center gap-1 px-3 py-1 rounded-lg text-12 font-semibold border-0 cursor-pointer transition-all ${
              activeTab === "history"
                ? "bg-indigo-600 text-white"
                : "bg-white bg-opacity-5 text-blue-300 hover:bg-opacity-10"
            }`}
          >
            📼 History
            {histCount > 0 && (
              <span className="text-9 font-bold px-1 rounded-full bg-white bg-opacity-20">
                {histCount}
              </span>
            )}
          </Button>
        </div>
        <Button
          onClick={() => setShowSettings(true)}
          className="flex items-center gap-1 px-3 py-1 rounded-lg bg-white bg-opacity-5 hover:bg-opacity-10 text-blue-300 text-12 font-semibold border-0 cursor-pointer transition-all"
        >
          ⚙️ Settings
        </Button>
      </div>

      {/* Folder path */}
      <div
        className="flex items-center gap-2 px-4 py-1 border-b border-white border-opacity-5 flex-shrink-0"
        style={{ background: "#090916", borderColor: "rgba(255,255,255,0.05)" }}
      >
        <span className="text-11 text-blue-500">📁</span>
        <span className="text-10 text-blue-500 font-mono truncate">
          \\Users\HieuTran\Pictures\VEO3\videos
        </span>
      </div>

      {/* Search */}
      <div
        className="px-4 py-2 border-b border-white border-opacity-5 flex-shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <div
          className="flex items-center gap-2 px-3 py-1 rounded-lg bg-white bg-opacity-5 border border-white border-opacity-8"
          style={{ borderColor: "rgba(255,255,255,0.08)" }}
        >
          <span className="text-12 text-blue-500">🔍</span>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm video..."
            className="flex-1 bg-transparent border-0 outline-none text-12 text-blue-100 placeholder-blue-600"
          />
        </div>
      </div>

      {/* Filter tags */}
      <div
        className="flex items-center gap-2 px-4 py-2 border-b border-white border-opacity-5 flex-shrink-0"
        style={{ borderColor: "rgba(255,255,255,0.05)" }}
      >
        <span
          className="flex items-center gap-1 text-10 font-bold px-2 py-1 rounded-md bg-white bg-opacity-8 text-blue-200 border border-white border-opacity-10"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          📄 Text To Video
        </span>
        <span className="text-10 font-semibold px-2 py-1 rounded-md bg-indigo-900 bg-opacity-40 text-indigo-300 border border-indigo-500 border-opacity-20">
          {useMock ? MOCK_VIDEOS.length : totalCount} Video
        </span>
        <span className="text-10 font-semibold px-2 py-1 rounded-md bg-white bg-opacity-5 text-blue-400 border border-white border-opacity-10">
          {speed}
        </span>
        <span className="text-10 font-semibold px-2 py-1 rounded-md bg-white bg-opacity-5 text-blue-400 border border-white border-opacity-10">
          {videoConfig.aspectRatio}
        </span>
      </div>

      {/* Video grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {(displayItems as any[]).length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="text-48 mb-3 opacity-30">
                {activeTab === "generating" ? "⏳" : "📼"}
              </div>
              <div className="text-13 text-blue-400 font-medium">
                {activeTab === "generating" ? "Chưa có video đang tạo" : "Chưa có video hoàn thành"}
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
            {useMock
              ? MOCK_VIDEOS.map((v, idx) => (
                  <VideoCardLight
                    key={v.id}
                    index={idx}
                    thumbnail={v.thumbnail}
                    label={v.label}
                    aspectRatio={v.aspectRatio}
                    styleTag={v.styleTag}
                    quality={v.quality}
                    description={v.description}
                    model={v.model}
                    seed={v.seed}
                    timeInfo={v.timeInfo}
                    status={v.status}
                    onZoom={(src) => setZoomSrc({ src, type: "image" })}
                  />
                ))
              : (displayItems as PromptItem[]).map((item, idx) => (
                  <VideoCardLight
                    key={item.id}
                    index={idx}
                    thumbnail={item.videoSrc}
                    label="TEXT TO VIDEO"
                    aspectRatio={videoConfig.aspectRatio}
                    styleTag={speed}
                    description={item.promptText}
                    model={videoConfig.model}
                    seed={Math.floor(Math.random() * 999999)
                      .toString()
                      .padStart(6, "0")}
                    timeInfo={new Date().toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    status={
                      item.videoStatus === "loading"
                        ? "generating"
                        : item.videoStatus === "done"
                        ? "done"
                        : item.videoStatus === "error"
                        ? "error"
                        : "idle"
                    }
                    onZoom={(src) => setZoomSrc({ src, type: "video" })}
                  />
                ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ── VideoCard ─────────────────────────────────────────────────────────────
function VideoCardLight({
  index,
  thumbnail,
  label,
  aspectRatio,
  styleTag,
  quality,
  description,
  model,
  seed,
  timeInfo,
  status,
  onZoom,
}: {
  index: number;
  thumbnail?: string;
  label: string;
  aspectRatio: string;
  styleTag: string;
  quality?: string;
  description: string;
  model: string;
  seed: string;
  timeInfo: string;
  status: "generating" | "done" | "error" | "idle";
  onZoom?: (src: string) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isGenerating = status === "generating";

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="rounded-xl overflow-hidden border border-white border-opacity-8 flex flex-col cursor-pointer transition-all duration-200"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderColor: hovered ? "rgba(99,102,241,0.4)" : "rgba(255,255,255,0.08)",
        transform: hovered ? "translateY(-2px)" : "none",
        boxShadow: hovered ? "0 8px 32px rgba(0,0,0,0.5)" : "none",
      }}
    >
      {/* Thumbnail area */}
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16/9", background: "#0a0a1a" }}
      >
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="w-full h-full object-cover"
            onClick={() => onZoom?.(thumbnail)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center">
            {isGenerating ? (
              <>
                <div className="text-24 animate-spin mb-1">⚙️</div>
                <div className="text-10 text-blue-400 font-medium">Generating...</div>
              </>
            ) : (
              <div className="text-48 opacity-20">🎬</div>
            )}
            {/* Placeholder number */}
            {!isGenerating && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-24 font-bold text-blue-700 opacity-30">
                  #{String(index + 1).padStart(3, "0")}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Top badges overlay */}
        <div className="absolute top-0 left-0 right-0 flex items-center gap-1 p-2">
          <span className="text-8 font-bold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-300">
            #{index + 1}
          </span>
          <span className="text-8 font-bold px-1 py-0 rounded bg-indigo-900 bg-opacity-80 text-indigo-300">
            📄 {label}
          </span>
          <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-400">
            {aspectRatio}
          </span>
          <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-cyan-400">
            {styleTag}
          </span>
          {quality && (
            <span className="text-8 font-semibold px-1 py-0 rounded bg-black bg-opacity-60 text-yellow-400">
              {quality}
            </span>
          )}
          {/* Status badge right */}
          <div className="ml-auto">
            {isGenerating ? (
              <span className="text-8 font-bold px-1 py-0 rounded bg-yellow-900 bg-opacity-80 text-yellow-400">
                ĐANG XỬ LÝ
              </span>
            ) : status === "done" ? (
              <span className="text-8 font-bold px-1 py-0 rounded bg-green-900 bg-opacity-80 text-green-400">
                DONE
              </span>
            ) : (
              <span className="text-8 font-bold px-1 py-0 rounded bg-black bg-opacity-60 text-blue-500">
                HÀNG ĐỢI
              </span>
            )}
          </div>
        </div>

        {/* Play button overlay */}
        {thumbnail && (
          <div
            className="absolute inset-0 flex items-center justify-center transition-opacity duration-200"
            style={{ opacity: hovered ? 1 : 0 }}
          >
            <div className="w-10 h-10 rounded-full bg-black bg-opacity-60 border-2 border-white border-opacity-80 flex items-center justify-center">
              <span className="text-14 text-white ml-1">▶</span>
            </div>
          </div>
        )}
      </div>

      {/* Description */}
      <div className="px-3 py-2 flex-1">
        <p className="text-10 text-blue-300 leading-relaxed line-clamp-2">{description}</p>
      </div>

      {/* Metadata footer */}
      <div className="flex items-center gap-1 px-3 pb-2 flex-wrap">
        <span className="text-8 text-blue-600 font-mono">
          ~{Math.floor(Math.random() * 5) + 1}p {Math.floor(Math.random() * 59) + 1}s
        </span>
      </div>
    </div>
  );
}
