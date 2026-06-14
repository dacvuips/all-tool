import { ReactNode, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftRightLine,
  RiArrowRightLine,
  RiAspectRatioLine,
  RiImageLine,
  RiMagicLine,
  RiPlayCircleLine,
  RiTShirtLine,
} from "react-icons/ri";

import { Popover } from "../../../shared/utilities/popover/popover";
import { WolfMediaAsset, WolfMediaLibrary } from "./wolf-media-library";

type MediaType = "image" | "video";
type VideoMode = "frame" | "component";
type ImageAspectRatio = "16:9" | "9:16";
type VideoAspectRatio = "9:16" | "16:9";
type Multiplier = "1x" | "x2" | "x3" | "x4";
type Duration = "4s" | "6s" | "8s" | "10s";

const IMAGE_MODELS = ["Nano Banana Pro", "Nano Banana 2", "Imagen 4 (Leaving 6/16)"];
const VIDEO_MODELS = [
  "Omni Flash",
  "Veo 3.1 Quality",
  "Veo 3.1 Fast",
  "Veo 3.1 Lite (Lower Priority )",
];

const ALL_DURATIONS: Duration[] = ["4s", "6s", "8s", "10s"];
const DURATIONS_WITHOUT_10S: Duration[] = ["4s", "6s", "8s"];
const OMNI_FLASH_MODEL = "Omni Flash";

const SETTINGS_PANEL_WIDTH = "w-[280px]";

const BTN_INACTIVE =
  "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50";
const BTN_ACTIVE = "border border-blue-500 bg-blue-50 text-blue-600 shadow-sm";

function SegmentedTrack({ children }: { children: ReactNode }) {
  return <div className="flex gap-1">{children}</div>;
}

function SegmentButton({
  active,
  children,
  onClick,
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 items-center whitespace-nowrap justify-center gap-1 rounded-lg px-2 py-1.5 text-[11px] font-medium transition-all duration-200 ${
        active ? BTN_ACTIVE : BTN_INACTIVE
      }`}
    >
      {children}
    </button>
  );
}

function ChipButton({
  active,
  children,
  onClick,
  className = "",
}: {
  active?: boolean;
  children: ReactNode;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-1.5 py-1 text-[11px] font-medium transition-all duration-200 ${className} ${
        active ? BTN_ACTIVE : BTN_INACTIVE
      }`}
    >
      {children}
    </button>
  );
}

function RatioIcon({ landscape }: { landscape: boolean }) {
  return (
    <div
      className={`rounded-sm border-2 border-current ${landscape ? "h-2.5 w-4" : "h-4 w-2.5"}`}
    />
  );
}

function AspectRatioButton({
  active,
  ratio,
  label,
  landscape,
  onClick,
}: {
  active: boolean;
  ratio: string;
  label: string;
  landscape: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 transition-all duration-200 ${
        active ? BTN_ACTIVE : BTN_INACTIVE
      }`}
    >
      <RatioIcon landscape={landscape} />
      <span className="leading-none">
        <span className="block text-[11px] font-semibold">{ratio}</span>
        <span className="mt-0.5 block text-[10px] font-medium opacity-90">{label}</span>
      </span>
    </button>
  );
}

export function WolfWorkspaceComposer({
  projectId,
  projectName,
}: {
  projectId?: string | null;
  projectName?: string;
}) {
  const { t } = useTranslation();
  const settingsRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [videoMode, setVideoMode] = useState<VideoMode>("component");
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>("16:9");
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [multiplier, setMultiplier] = useState<Multiplier>("x2");
  const [duration, setDuration] = useState<Duration>("10s");
  const [modelIndex, setModelIndex] = useState(0);
  const [showModelMenu, setShowModelMenu] = useState(false);

  const models = mediaType === "image" ? IMAGE_MODELS : VIDEO_MODELS;
  const selectedModel = models[modelIndex] ?? models[0];

  const statusLabel = useMemo(() => {
    if (mediaType === "image") {
      return `${imageAspectRatio} · ${multiplier}`;
    }
    return `${duration} · ${videoAspectRatio} · ${multiplier}`;
  }, [duration, imageAspectRatio, mediaType, multiplier, videoAspectRatio]);

  const credits = mediaType === "video" ? 24 : 12;
  const showFrameControls = mediaType === "video" && videoMode === "frame";

  const durationOptions = useMemo((): Duration[] => {
    if (mediaType !== "video") return [];
    if (selectedModel === OMNI_FLASH_MODEL) return ALL_DURATIONS;
    return DURATIONS_WITHOUT_10S;
  }, [mediaType, selectedModel]);

  const aspectOptions =
    mediaType === "image"
      ? [
          { value: "9:16" as const, label: t("Dọc"), landscape: false },
          { value: "16:9" as const, label: t("Ngang"), landscape: true },
        ]
      : [
          { value: "9:16" as const, label: t("Dọc"), landscape: false },
          { value: "16:9" as const, label: t("Ngang"), landscape: true },
        ];

  const handleAddToCommand = (asset: WolfMediaAsset) => {
    const tag = asset.type === "image" ? t("Hình ảnh") : t("Video");
    setPrompt((prev) => (prev ? `${prev} [${tag}: ${asset.name}]` : `[${tag}: ${asset.name}]`));
  };

  return (
    <div className="relative px-4 pb-5">
      <div className="p-4 bg-white rounded-2xl border shadow-lg border-slate-200 shadow-slate-200/50">
        {showFrameControls && (
          <div className="flex gap-2 items-center mb-3">
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${BTN_INACTIVE}`}
            >
              {t("Bắt đầu")}
            </button>
            <RiArrowLeftRightLine className="text-slate-400" />
            <button
              type="button"
              className={`rounded-xl px-3 py-1.5 text-xs font-medium ${BTN_INACTIVE}`}
            >
              {t("Kết thúc")}
            </button>
          </div>
        )}

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={showFrameControls ? 2 : 1}
          placeholder={t("Bạn muốn tạo gì?")}
          className="w-full text-sm leading-relaxed bg-transparent outline-none resize-none text-slate-700 placeholder:text-slate-400"
        />

        <div
          ref={settingsRef}
          className="flex gap-3 justify-between items-center pt-3 mt-3 border-t border-slate-100"
        >
          <div className="flex gap-2 items-center">
            <button
              ref={addButtonRef}
              type="button"
              onClick={() => {
                setShowAssetLibrary((prev) => !prev);
                setShowSettings(false);
              }}
              aria-expanded={showAssetLibrary}
              className={`flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 ${
                showAssetLibrary ? BTN_ACTIVE : BTN_INACTIVE
              }`}
            >
              <RiAddLine
                className={`text-lg transition-transform ${showAssetLibrary ? "rotate-45" : ""}`}
              />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            <button
              type="button"
              onClick={() => {
                setShowSettings(true);
                setShowAssetLibrary(false);
              }}
              className={`flex max-w-[180px] items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${BTN_INACTIVE}`}
            >
              {mediaType === "image" ? (
                <RiMagicLine className="flex-shrink-0 text-amber-500" />
              ) : (
                <RiPlayCircleLine className="flex-shrink-0 text-slate-500" />
              )}
              <span className="truncate">{statusLabel}</span>
            </button>
            <button
              type="button"
              className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-white bg-blue-600 rounded-full border border-blue-500 shadow-sm transition-all hover:bg-blue-700"
            >
              <RiArrowRightLine className="text-lg" />
            </button>
          </div>
        </div>
      </div>

      <WolfMediaLibrary
        reference={addButtonRef}
        visible={showAssetLibrary}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setShowAssetLibrary(false)}
        onAddToCommand={handleAddToCommand}
      />

      <Popover
        key={showSettings ? "wolf-settings-open" : "wolf-settings-closed"}
        reference={settingsRef}
        trigger="click"
        placement="top-end"
        arrow={false}
        maxWidth={280}
        visible={showSettings}
        hideOnClickOutside
        zIndex={100}
        className="rounded-xl"
        onHidden={() => setShowSettings(false)}
        onClickOutside={() => setShowSettings(false)}
      >
        <div className={`overflow-visible rounded-xl ${SETTINGS_PANEL_WIDTH}`}>
          <div className="overflow-visible p-3 space-y-3">
            <SegmentedTrack>
              <SegmentButton
                active={mediaType === "image"}
                onClick={() => {
                  setMediaType("image");
                  setModelIndex(0);
                  setShowModelMenu(false);
                }}
              >
                <RiImageLine className="text-sm" />
                {t("Hình ảnh")}
              </SegmentButton>
              <SegmentButton
                active={mediaType === "video"}
                onClick={() => {
                  setMediaType("video");
                  setModelIndex(0);
                  setShowModelMenu(false);
                }}
              >
                <RiPlayCircleLine className="text-sm" />
                {t("Video")}
              </SegmentButton>
            </SegmentedTrack>

            {mediaType === "video" && (
              <SegmentedTrack>
                <SegmentButton active={videoMode === "frame"} onClick={() => setVideoMode("frame")}>
                  <RiAspectRatioLine className="text-sm" />
                  {t("Khung hình")}
                </SegmentButton>
                <SegmentButton
                  active={videoMode === "component"}
                  onClick={() => setVideoMode("component")}
                >
                  <RiTShirtLine className="text-sm" />
                  {t("Thành phần")}
                </SegmentButton>
              </SegmentedTrack>
            )}

            <div className="flex gap-1">
              {aspectOptions.map((option) => (
                <AspectRatioButton
                  key={option.value}
                  active={
                    mediaType === "image"
                      ? imageAspectRatio === option.value
                      : videoAspectRatio === option.value
                  }
                  ratio={option.value}
                  label={""}
                  landscape={option.landscape}
                  onClick={() =>
                    mediaType === "image"
                      ? setImageAspectRatio(option.value)
                      : setVideoAspectRatio(option.value)
                  }
                />
              ))}
            </div>

            <div className="flex gap-1">
              {(["1x", "x2", "x3", "x4"] as Multiplier[]).map((value) => (
                <ChipButton
                  key={value}
                  active={multiplier === value}
                  onClick={() => setMultiplier(value)}
                  className="flex-1"
                >
                  {value}
                </ChipButton>
              ))}
            </div>

            <div className={`relative ${showModelMenu ? "z-30" : ""}`}>
              <button
                type="button"
                onClick={() => setShowModelMenu((prev) => !prev)}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-[11px] transition-all duration-200 ${
                  showModelMenu ? BTN_ACTIVE : BTN_INACTIVE
                }`}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded bg-amber-50 text-[10px]">
                    {mediaType === "image" ? "🍌" : "🎥"}
                  </span>
                  <span className="font-semibold truncate">{selectedModel}</span>
                </span>
                <RiArrowDownSLine
                  className={`flex-shrink-0 text-base transition-transform ${
                    showModelMenu ? "rotate-180" : "opacity-60"
                  }`}
                />
              </button>
              {showModelMenu && (
                <div className="overflow-hidden absolute right-0 left-0 bottom-full z-40 mb-1 bg-white rounded-lg border shadow-lg border-slate-200">
                  {models.map((model, index) => (
                    <button
                      key={model}
                      type="button"
                      onClick={() => {
                        const nextModel = models[index];
                        setModelIndex(index);
                        setShowModelMenu(false);
                        if (nextModel !== OMNI_FLASH_MODEL && duration === "10s") {
                          setDuration("8s");
                        }
                      }}
                      className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-slate-50 ${
                        modelIndex === index
                          ? "bg-blue-50 font-medium text-blue-600"
                          : "text-slate-600"
                      }`}
                    >
                      <span className="text-[10px]">{mediaType === "image" ? "🍌" : "🎥"}</span>
                      <span className="truncate">{model}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {mediaType === "video" && (
              <div className="flex gap-1">
                {durationOptions.map((value) => (
                  <ChipButton
                    key={value}
                    active={duration === value}
                    onClick={() => setDuration(value)}
                    className="flex-1"
                  >
                    {value}
                  </ChipButton>
                ))}
              </div>
            )}
          </div>
        </div>
      </Popover>
    </div>
  );
}
