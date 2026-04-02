import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DEFAULT_VIDEO_CONFIG, MOCK_VIDEOS, PromptItem, VideoConfig } from "../constants";
export const AffiliateVideoContext = createContext<
  Partial<{
    modeTab: ModeTab;
    setModeTab: (modeTab: ModeTab) => void;
    speed: SpeedMode | string;
    setSpeed: (speed: SpeedMode | string) => void;
    delayQueue: DelayQueue;
    setDelayQueue: (delayQueue: DelayQueue) => void;
    searchQuery: string;
    setSearchQuery: (searchQuery: string) => void;
    voiceMode: VoiceMode;
    setVoiceMode: (voiceMode: VoiceMode) => void;
    videoConfig: VideoConfig;
    setVideoConfig: (videoConfig: VideoConfig) => void;
    promptItems: PromptItem[];
    setPromptItems: (promptItems: PromptItem[]) => void;
    showAiModal: boolean;
    setShowAiModal: (showAiModal: boolean) => void;
    batchRunning: boolean;
    setBatchRunning: (batchRunning: boolean) => void;
    activeTab: MainTab;
    setActiveTab: (activeTab: MainTab) => void;
    showSettings: boolean;
    setShowSettings: (showSettings: boolean) => void;
    zoomSrc: { src: string; type: "image" | "video" } | null;
    setZoomSrc: (zoomSrc: { src: string; type: "image" | "video" } | null) => void;
    stopRef: React.MutableRefObject<boolean>;
    SpeedModeOptions?: { label: string; value: SpeedMode | string }[];
    DelayQueueOptions?: { label: string; value: DelayQueue | string }[];
    ModeTabOptions?: { label: string; value: ModeTab | string }[];
    MainTabOptions?: { label: string; value: MainTab | string }[];
    VoiceModeOptions?: { label: string; value: VoiceMode | string }[];
    VideoCountOptions?: { label: string; value: number }[];
    totalCount: number;
    doneCount: number;
    generatingItems: PromptItem[];
    historyItems: PromptItem[];
    patchConfig: (p: Partial<VideoConfig>) => void;
    removeItem: (id: string) => void;
    updateItem: (id: string, patch: Partial<PromptItem>) => void;
    useMock: boolean;
    displayItems: PromptItem[];
    genCount: number;
    histCount: number;
  }>
>({});

export function AffiliateVideoProvider(props) {
  const { t } = useTranslation();

  const [modeTab, setModeTab] = useState<ModeTab>("text");
  const [speed, setSpeed] = useState<SpeedMode | string>("relaxed");
  const [delayQueue, setDelayQueue] = useState<DelayQueue>("15s");
  const [searchQuery, setSearchQuery] = useState("");
  const [voiceMode, setVoiceMode] = useState<VoiceMode>("none");
  const [videoConfig, setVideoConfig] = useState<VideoConfig>(DEFAULT_VIDEO_CONFIG);
  const [promptItems, setPromptItems] = useState<PromptItem[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [batchRunning, setBatchRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>("generating");
  const [showSettings, setShowSettings] = useState(false);
  const [zoomSrc, setZoomSrc] = useState<{ src: string; type: "image" | "video" } | null>(null);
  const stopRef = useRef(false);
  const SpeedModeOptions: { label: string; value: SpeedMode }[] = [
    { label: t("Nhanh"), value: "fast" },
    { label: t("Thoải mái"), value: "relaxed" },
    { label: t("Chất lượng"), value: "quality" },
  ];

  const DelayQueueOptions = [
    { label: "15s", value: "15s" },
    { label: "30s", value: "30s" },
    { label: "1m", value: "1m" },
  ];

  const ModeTabOptions = [
    { label: t("Text"), value: "text" },
    { label: t("Ảnh đầu"), value: "start_image" },
    { label: t("Ảnh đầu cuối"), value: "start_end" },
    { label: t("Đồng bộ"), value: "sync" },
  ];

  const MainTabOptions = [
    { label: t("Đang tạo"), value: "generating" },
    { label: t("Lịch sử"), value: "history" },
  ];

  const VoiceModeOptions = [
    { label: t("Không"), value: "none" },
    { label: t("Trong video"), value: "in_video" },
    { label: t("Riêng biệt"), value: "separate" },
  ];
  const VideoCountOptions = [
    { label: "1", value: 1 },
    { label: "2", value: 2 },
    { label: "3", value: 3 },
    { label: "4", value: 4 },
    { label: "5", value: 5 },
    { label: "6", value: 6 },
    { label: "7", value: 7 },
  ];
  const totalCount = promptItems.length;
  const doneCount = promptItems.filter((i) => i.videoStatus === "done").length;
  const generatingItems = promptItems.filter((i) => i.videoStatus !== "done");
  const historyItems = promptItems.filter((i) => i.videoStatus === "done");
  const patchConfig = (p: Partial<VideoConfig>) => setVideoConfig((c) => ({ ...c, ...p }));
  const removeItem = (id: string) => setPromptItems((prev) => prev.filter((i) => i.id !== id));

  const updateItem = useCallback((id: string, patch: Partial<PromptItem>) => {
    setPromptItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);
  const useMock = totalCount === 0;
  const mockToPromptItem = (v: typeof MOCK_VIDEOS[number]): PromptItem => ({
    id: v.id,
    promptText: v.description,
    videoSrc: v.thumbnail,
    videoStatus: v.status === "done" ? "done" : "loading",
    audioStatus: "idle",
  });
  const displayItems: PromptItem[] =
    activeTab === "generating"
      ? useMock
        ? MOCK_VIDEOS.filter((v) => v.status === "generating").map(mockToPromptItem)
        : generatingItems
      : useMock
      ? MOCK_VIDEOS.filter((v) => v.status === "done").map(mockToPromptItem)
      : historyItems;
  const genCount = useMock
    ? MOCK_VIDEOS.filter((v) => v.status === "generating").length
    : generatingItems.length;
  const histCount = useMock
    ? MOCK_VIDEOS.filter((v) => v.status === "done").length
    : historyItems.length;

  return (
    <AffiliateVideoContext.Provider
      value={{
        modeTab,
        setModeTab,
        speed,
        setSpeed,
        delayQueue,
        setDelayQueue,
        searchQuery,
        setSearchQuery,
        voiceMode,
        setVoiceMode,
        videoConfig,
        setVideoConfig,
        promptItems,
        setPromptItems,
        showAiModal,
        setShowAiModal,
        batchRunning,
        setBatchRunning,
        activeTab,
        setActiveTab,
        showSettings,
        setShowSettings,
        zoomSrc,
        setZoomSrc,
        stopRef,
        SpeedModeOptions,
        DelayQueueOptions,
        ModeTabOptions,
        MainTabOptions,
        VoiceModeOptions,
        VideoCountOptions,
        totalCount,
        doneCount,
        generatingItems,
        historyItems,
        patchConfig,
        removeItem,
        updateItem,
        useMock,
        displayItems,
        genCount,
        histCount,
      }}
    >
      {props.children}
    </AffiliateVideoContext.Provider>
  );
}

export const useAffiliateVideoContext = () => useContext(AffiliateVideoContext);
