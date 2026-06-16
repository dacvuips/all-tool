import {
  MutableRefObject,
  ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftRightLine,
  RiArrowRightLine,
  RiAspectRatioLine,
  RiCloseLine,
  RiImageLine,
  RiLoader4Line,
  RiMagicLine,
  RiPlayCircleLine,
  RiTShirtLine,
} from "react-icons/ri";

import { useToast } from "../../../../lib/providers/toast-provider";
import { Popover } from "../../../shared/utilities/popover/popover";
import { DB_NAME, STORE_NAME } from "../constants";
import { useIndexedDB } from "../hook/useIndexedDB";
import { WolfMediaAsset, WolfMediaAssetThumb, WolfMediaLibrary } from "./wolf-media-library";
import { WolfProjectItem } from "./wolf-project-item";
import {
  buildWolfComposerSettingsSnapshot,
  getWolfComposerSettingsKey,
  normalizeWolfComposerSettings,
  WolfComposerSettings,
} from "./wolf-workspace-composer-settings";
import {
  useWolfWorkspaceGeneration,
  WOLF_IMAGE_MODELS,
  WOLF_MAX_COMPONENT_REFERENCES,
  WOLF_MAX_IMAGE_REFERENCES,
  WolfGenerationSubmitInput,
  WolfImageModelKey,
  WolfMultiplier,
} from "./wolf-workspace-generation";

type MediaType = "image" | "video";
type VideoMode = "frame" | "component";
type ImageAspectRatio = "16:9" | "9:16";
type VideoAspectRatio = "9:16" | "16:9";
type Duration = "4s" | "6s" | "8s" | "10s";
type FrameSlot = "start" | "end";
const VIDEO_MODELS = [
  "Veo 3.1 Lite (Lower Priority )",
  "Veo 3.1 Quality",
  "Veo 3.1 Fast",
  "Omni Flash",
] as const;

const MPOINT_VIDEO_MODELS = new Set<string>(["Veo 3.1 Quality", "Veo 3.1 Fast", "Omni Flash"]);

const ALL_DURATIONS: Duration[] = ["4s", "6s", "8s", "10s"];
const DURATIONS_WITHOUT_10S: Duration[] = ["4s", "6s", "8s"];
const OMNI_FLASH_MODEL = "Omni Flash";

function isMPointVideoModel(model: string): boolean {
  return MPOINT_VIDEO_MODELS.has(model);
}

const SETTINGS_PANEL_WIDTH = "w-[280px]";
const MAX_PROMPT_TEXTAREA_ROWS = 6;

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

function FrameSlotButton({
  label,
  asset,
  active,
  buttonRef,
  onClick,
  onRemove,
  removeLabel,
}: {
  label?: string;
  asset: WolfMediaAsset | null;
  active?: boolean;
  buttonRef?: MutableRefObject<HTMLButtonElement | null>;
  onClick: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  const slot = (
    <button
      ref={buttonRef}
      type="button"
      onClick={onClick}
      aria-label={label ?? asset?.name}
      className={`overflow-hidden rounded-xl transition-all duration-200 ${
        asset
          ? "relative block h-14 w-20 flex-shrink-0 border border-slate-200 bg-slate-50 p-0 shadow-sm"
          : `px-3 py-1.5 text-xs font-medium ${active ? BTN_ACTIVE : BTN_INACTIVE}`
      }`}
    >
      {asset ? (
        <WolfMediaAssetThumb asset={asset} className="absolute inset-0 w-full h-full" />
      ) : (
        label
      )}
    </button>
  );

  if (!asset || !onRemove) return slot;

  return (
    <div className="relative flex-shrink-0">
      {slot}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="flex absolute -top-1 -right-1 z-10 justify-center items-center w-5 h-5 text-white bg-red-600 rounded-full transition-colors hover:bg-red-300"
        aria-label={removeLabel}
      >
        <RiCloseLine className="text-sm" />
      </button>
    </div>
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
  generating,
  progress,
  submit,
  onGenerationItemsCreated,
  onGenerationItemProgress,
  onGenerationItemUpdated,
  onGenerationSceneMediaUpdated,
}: {
  projectId?: string | null;
  projectName?: string;
  generating: boolean;
  progress: number;
  submit: ReturnType<typeof useWolfWorkspaceGeneration>["submit"];
  onGenerationItemsCreated?: (items: WolfProjectItem[]) => void;
  onGenerationItemProgress?: (itemIds: string[], progress: number) => void;
  onGenerationItemUpdated?: (item: WolfProjectItem) => void;
  onGenerationSceneMediaUpdated?: WolfGenerationSubmitInput["onSceneMediaUpdated"];
}) {
  const { t } = useTranslation();
  const toast = useToast();
  const settingsRef = useRef<HTMLDivElement>(null);
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const startFrameRef = useRef<HTMLButtonElement>(null);
  const endFrameRef = useRef<HTMLButtonElement>(null);
  const frameLibraryTargetRef = useRef<FrameSlot | null>(null);
  const promptTextareaRef = useRef<HTMLTextAreaElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showAssetLibrary, setShowAssetLibrary] = useState(false);
  const [showFrameLibrary, setShowFrameLibrary] = useState(false);
  const [frameLibraryTarget, setFrameLibraryTarget] = useState<FrameSlot | null>(null);
  const [startFrameAsset, setStartFrameAsset] = useState<WolfMediaAsset | null>(null);
  const [endFrameAsset, setEndFrameAsset] = useState<WolfMediaAsset | null>(null);
  const [attachedAssets, setAttachedAssets] = useState<WolfMediaAsset[]>([]);
  const [prompt, setPrompt] = useState("");
  const [mediaType, setMediaType] = useState<MediaType>("video");
  const [videoMode, setVideoMode] = useState<VideoMode>("component");
  const [imageAspectRatio, setImageAspectRatio] = useState<ImageAspectRatio>("16:9");
  const [videoAspectRatio, setVideoAspectRatio] = useState<VideoAspectRatio>("16:9");
  const [duration, setDuration] = useState<Duration>("10s");
  const [imageModelKey, setImageModelKey] = useState<WolfImageModelKey>("bananaPro");
  const [videoModelIndex, setVideoModelIndex] = useState(0);
  const [multiplier, setMultiplier] = useState<WolfMultiplier>("x2");
  const [showModelMenu, setShowModelMenu] = useState(false);
  const [isSettingsHydrated, setIsSettingsHydrated] = useState(false);

  const settingsDB = useIndexedDB<WolfComposerSettings>(
    STORE_NAME.wolfComposerSettings,
    DB_NAME.wolf
  );
  const composerSettingsKey = getWolfComposerSettingsKey(projectId);

  const applyComposerSettings = useCallback((settings: WolfComposerSettings) => {
    setMediaType(settings.mediaType);
    setVideoMode(settings.videoMode);
    setImageAspectRatio(settings.imageAspectRatio);
    setVideoAspectRatio(settings.videoAspectRatio);
    setDuration(settings.duration);
    setImageModelKey(settings.imageModelKey);
    setVideoModelIndex(settings.videoModelIndex);
    setMultiplier(settings.multiplier);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsSettingsHydrated(false);

    void (async () => {
      const saved = await settingsDB.get(composerSettingsKey);
      if (cancelled) return;

      const normalized = normalizeWolfComposerSettings(
        saved,
        composerSettingsKey,
        VIDEO_MODELS.length
      );
      if (normalized) {
        const savedModel = VIDEO_MODELS[normalized.videoModelIndex];
        if (savedModel && isMPointVideoModel(savedModel)) {
          normalized.videoModelIndex = 0;
        }
        applyComposerSettings(normalized);
      }
      setIsSettingsHydrated(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [applyComposerSettings, composerSettingsKey, settingsDB]);

  useEffect(() => {
    if (!isSettingsHydrated) return;

    const snapshot = buildWolfComposerSettingsSnapshot(
      {
        projectId: composerSettingsKey,
        mediaType,
        videoMode,
        imageAspectRatio,
        videoAspectRatio,
        duration,
        imageModelKey,
        videoModelIndex,
        multiplier,
      },
      VIDEO_MODELS.length
    );

    void settingsDB.set(composerSettingsKey, snapshot);
  }, [
    composerSettingsKey,
    duration,
    imageAspectRatio,
    imageModelKey,
    isSettingsHydrated,
    mediaType,
    multiplier,
    settingsDB,
    videoAspectRatio,
    videoMode,
    videoModelIndex,
  ]);

  const selectedImageModel =
    WOLF_IMAGE_MODELS.find((item) => item.key === imageModelKey) ?? WOLF_IMAGE_MODELS[0];
  const selectedVideoModel = VIDEO_MODELS[videoModelIndex] ?? VIDEO_MODELS[0];
  const selectedModel = mediaType === "image" ? selectedImageModel.label : selectedVideoModel;

  const statusLabel = useMemo(() => {
    if (mediaType === "image") {
      return `${imageAspectRatio} · ${multiplier}`;
    }
    return `${duration} · ${videoAspectRatio} · ${multiplier}`;
  }, [duration, imageAspectRatio, mediaType, multiplier, videoAspectRatio]);

  const credits = mediaType === "video" ? 24 : 12;
  const showFrameControls = mediaType === "video" && videoMode === "frame";
  const showAddButton = !showFrameControls;
  const showAttachedAssets = showAddButton;

  const adjustPromptTextareaHeight = useCallback(() => {
    const el = promptTextareaRef.current;
    if (!el) return;

    el.style.height = "auto";
    const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 22;
    const maxHeight = lineHeight * MAX_PROMPT_TEXTAREA_ROWS;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  useEffect(() => {
    adjustPromptTextareaHeight();
  }, [adjustPromptTextareaHeight, prompt, showFrameControls]);

  const durationOptions = useMemo((): Duration[] => {
    if (mediaType !== "video") return [];
    if (selectedVideoModel === OMNI_FLASH_MODEL) return ALL_DURATIONS;
    return DURATIONS_WITHOUT_10S;
  }, [mediaType, selectedVideoModel]);

  const maxAttachedAssets =
    mediaType === "image" ? WOLF_MAX_IMAGE_REFERENCES : WOLF_MAX_COMPONENT_REFERENCES;
  const canAddMoreAssets = showAddButton && attachedAssets.length < maxAttachedAssets;

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
    setAttachedAssets((prev) => {
      if (prev.some((item) => item.id === asset.id)) return prev;
      if (prev.length >= maxAttachedAssets) return prev;
      return [...prev, asset];
    });
  };

  const handleSubmit = useCallback(() => {
    if (generating || !prompt.trim()) return;

    const currentPrompt = prompt.trim();
    setPrompt("");

    void submit({
      mediaType,
      projectId,
      onItemsCreated: onGenerationItemsCreated,
      onItemProgress: onGenerationItemProgress,
      onItemUpdated: onGenerationItemUpdated,
      onSceneMediaUpdated: onGenerationSceneMediaUpdated,
      image:
        mediaType === "image"
          ? {
              prompt: currentPrompt,
              aspectRatio: imageAspectRatio,
              imageModel: imageModelKey,
              multiplier,
              referenceAssets: attachedAssets,
            }
          : undefined,
      video:
        mediaType === "video"
          ? {
              prompt: currentPrompt,
              aspectRatio: videoAspectRatio,
              videoMode,
              multiplier,
              referenceAssets: attachedAssets,
              startFrameAsset,
              endFrameAsset,
            }
          : undefined,
    });
  }, [
    attachedAssets,
    endFrameAsset,
    generating,
    imageAspectRatio,
    imageModelKey,
    mediaType,
    multiplier,
    onGenerationItemProgress,
    onGenerationItemsCreated,
    onGenerationItemUpdated,
    onGenerationSceneMediaUpdated,
    projectId,
    prompt,
    startFrameAsset,
    submit,
    videoAspectRatio,
    videoMode,
  ]);

  const handleRemoveAttachedAsset = (assetId: string) => {
    setAttachedAssets((prev) => prev.filter((item) => item.id !== assetId));
  };

  const openFrameLibrary = (target: FrameSlot) => {
    frameLibraryTargetRef.current = target;
    setFrameLibraryTarget(target);
    setShowFrameLibrary(true);
    setShowSettings(false);
    setShowAssetLibrary(false);
  };

  const handleFrameAssetSelect = (asset: WolfMediaAsset) => {
    if (asset.type !== "image") {
      toast.error(t("Khung hình chỉ hỗ trợ ảnh"));
      return;
    }
    const target = frameLibraryTargetRef.current ?? frameLibraryTarget;
    if (target === "start") {
      setStartFrameAsset(asset);
    } else if (target === "end") {
      setEndFrameAsset(asset);
    }
  };

  const frameLibraryRef = frameLibraryTarget === "end" ? endFrameRef : startFrameRef;

  return (
    <div className="relative px-4 pb-5">
      <div className="p-4 bg-white rounded-2xl border shadow-lg border-slate-200 shadow-slate-200/50">
        {showFrameControls && (
          <div className="flex gap-2 items-center mb-3">
            <FrameSlotButton
              label={t("Bắt đầu")}
              asset={startFrameAsset}
              buttonRef={startFrameRef}
              active={showFrameLibrary && frameLibraryTarget === "start"}
              onClick={() => openFrameLibrary("start")}
            />
            <RiArrowLeftRightLine className="text-slate-400" />
            <FrameSlotButton
              label={t("Kết thúc")}
              asset={endFrameAsset}
              buttonRef={endFrameRef}
              active={showFrameLibrary && frameLibraryTarget === "end"}
              onClick={() => openFrameLibrary("end")}
            />
          </div>
        )}
        {showAttachedAssets && attachedAssets.length > 0 && (
          <div className="flex gap-2 items-center mb-3">
            {attachedAssets.map((asset) => (
              <FrameSlotButton
                key={asset.id}
                asset={asset}
                removeLabel={t("Xóa ảnh")}
                onClick={() => {
                  setShowAssetLibrary(true);
                  setShowSettings(false);
                }}
                onRemove={() => handleRemoveAttachedAsset(asset.id)}
              />
            ))}
          </div>
        )}
        <textarea
          ref={promptTextareaRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={1}
          placeholder={t("Bạn muốn tạo gì?")}
          className="w-full text-sm leading-relaxed bg-transparent outline-none resize-none text-slate-700 placeholder:text-slate-400"
        />

        <div
          ref={settingsRef}
          className="flex gap-3 justify-between items-center pt-3 mt-3 border-t border-slate-100"
        >
          {showAddButton && (
            <div className="flex gap-2 items-center">
              {canAddMoreAssets && (
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
                    className={`text-lg transition-transform ${
                      showAssetLibrary ? "rotate-45" : ""}`}
                  />
                </button>
              )}
            </div>
          )}

          <div className={`flex gap-2 items-center ${showAddButton ? "":"ml-auto"}`}>
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
              onClick={handleSubmit}
              disabled={generating || !prompt.trim()}
              className="flex flex-shrink-0 justify-center items-center w-9 h-9 text-white bg-blue-600 rounded-full border border-blue-500 shadow-sm transition-all hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              aria-label={generating ? t("Đang tạo...") : t("Tạo")}
            >
              {generating ? (
                <RiLoader4Line className="text-lg animate-spin" />
              ) : (
                <RiArrowRightLine className="text-lg" />
              )}
            </button>
          </div>
        </div>
      </div>

      {generating && progress > 0 && (
        <div className="px-1 mt-2">
          <div className="overflow-hidden h-1 rounded-full bg-slate-100">
            <div
              className="h-full bg-blue-500 transition-all duration-300"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      <WolfMediaLibrary
        reference={addButtonRef}
        visible={showAddButton && canAddMoreAssets && showAssetLibrary}
        projectId={projectId}
        projectName={projectName}
        onClose={() => setShowAssetLibrary(false)}
        onAddToCommand={handleAddToCommand}
      />

      <WolfMediaLibrary
        reference={frameLibraryRef}
        visible={showFrameLibrary}
        projectId={projectId}
        projectName={projectName}
        onClose={() => {
          setShowFrameLibrary(false);
          setFrameLibraryTarget(null);
          frameLibraryTargetRef.current = null;
        }}
        onAddToCommand={handleFrameAssetSelect}
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
                  setImageModelKey("bananaPro");
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
                  setVideoModelIndex(0);
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
                  onClick={() => {
                    setVideoMode("component");
                    setShowAssetLibrary(false);
                  }}
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

            {(mediaType === "image" || mediaType === "video") && (
              <div className="grid grid-cols-4 gap-1">
                {(["1x", "x2", "x3", "x4", "x5", "x6", "x8", "x16"] as WolfMultiplier[]).map(
                  (value) => (
                    <ChipButton
                      key={value}
                      active={multiplier === value}
                      onClick={() => setMultiplier(value)}
                      className="flex-1"
                    >
                      {value}
                    </ChipButton>
                  )
                )}
              </div>
            )}

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
                  {mediaType === "image"
                    ? WOLF_IMAGE_MODELS.map((model) => (
                        <button
                          key={model.key}
                          type="button"
                          onClick={() => {
                            setImageModelKey(model.key);
                            setShowModelMenu(false);
                          }}
                          className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] transition-colors hover:bg-slate-50 ${
                            imageModelKey === model.key
                              ? "bg-blue-50 font-medium text-blue-600"
                              : "text-slate-600"
                          }`}
                        >
                          <span className="text-[10px]">🍌</span>
                          <span className="truncate">{model.label}</span>
                        </button>
                      ))
                    : VIDEO_MODELS.map((model, index) => {
                        const requiresMPoint = isMPointVideoModel(model);
                        return (
                          <button
                            key={model}
                            type="button"
                            onClick={() => {
                              if (requiresMPoint) {
                                toast.info(t("Chức năng này đang phát triển"));
                                return;
                              }
                              setVideoModelIndex(index);
                              setShowModelMenu(false);
                              if (model !== OMNI_FLASH_MODEL && duration === "10s") {
                                setDuration("8s");
                              }
                            }}
                            className={`flex w-full items-center gap-1.5 px-2.5 py-2 text-left text-[11px] transition-colors ${
                              requiresMPoint ? "cursor-not-allowed opacity-50" : "hover:bg-slate-50"
                            } ${
                              !requiresMPoint && videoModelIndex === index
                                ? "bg-blue-50 font-medium text-blue-600"
                                : "text-slate-600"
                            }`}
                          >
                            <span className="text-[10px]">🎥</span>
                            <span className="truncate">{model}</span>
                          </button>
                        );
                      })}
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
