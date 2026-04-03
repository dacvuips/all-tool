import { createContext, useContext, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  AffiliateVideoFormConfig,
  ART_STYLE_OPTIONS,
  CATEGORY_OPTIONS,
  LANGUAGE_OPTIONS,
  MOCK_SCRIPT,
  ScriptData,
} from "../constants";

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
    videoConfig: AffiliateVideoFormConfig;
    setVideoConfig: (videoConfig: AffiliateVideoFormConfig) => void;
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
    patchConfig: (p: Partial<AffiliateVideoFormConfig>) => void;

    useMock: boolean;
    genCount: number;
    histCount: number;

    /** Convenience getter – returns current form values as AffiliateFormConfig */
    affiliateFormConfig: AffiliateVideoFormConfig;
    // ── Script data ──
    scriptData: ScriptData | null;
    setScriptData: (data: ScriptData | null) => void;
    scriptTab: "script" | "batch";
    setScriptTab: (tab: "script" | "batch") => void;
    batchList: string[];
    setBatchList: (list: string[]) => void;
    handleSubmit: (data: AffiliateVideoFormConfig, promptText?: string) => void;
    affiliateVideoFormConfig: AffiliateVideoFormConfig;
    setAffiliateVideoFormConfig: (videoConfig: AffiliateVideoFormConfig) => void;
    defaultVideoConfig: AffiliateVideoFormConfig;
  }>
>({});

export function AffiliateVideoProvider(props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const stopRef = useRef(false);

  // ── Script / Batch state ──
  const [scriptData, setScriptData] = useState<ScriptData | null>(MOCK_SCRIPT);
  const [scriptTab, setScriptTab] = useState<"script" | "batch">("script");
  const [batchList, setBatchList] = useState<string[]>(["Kịch bản 1"]);
  const [batchRunning, setBatchRunning] = useState(false);
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
  const defaultVideoConfig: AffiliateVideoFormConfig = {
    category: CATEGORY_OPTIONS[0].label,
    objectToPersonify: "Một quả chuối tươi",
    tipContent: "Cách ăn chuối tốt nhất",
    mood: "Vui vẻ",
    language: LANGUAGE_OPTIONS[0].label,
    artStyle: ART_STYLE_OPTIONS[0].label,
    storyModeType: "image_to_video",
    aspectRatio: "9:16",
    batchSize: 1,
  };
  const [affiliateVideoFormConfig, setAffiliateVideoFormConfig] =
    useState<AffiliateVideoFormConfig>(defaultVideoConfig);

  const handleSubmit = async (data: AffiliateVideoFormConfig, promptText?: string) => {
    try {
      const res = await fetch("/api/app/generation-scene/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: data,
        }),
      });
      setBatchRunning(true);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.error(err?.message || `Lỗi ${res.status}`);
      }
      const result = await res.json();
      console.log("[affiliate-video] submit success", result);
      return result;
    } catch (err: any) {
      console.error("[affiliate-video] submit error", err?.message);
      throw err;
    }
  };

  return (
    <AffiliateVideoContext.Provider
      value={{
        searchQuery,
        setSearchQuery,

        stopRef,
        SpeedModeOptions,
        DelayQueueOptions,
        ModeTabOptions,
        MainTabOptions,
        VoiceModeOptions,
        VideoCountOptions,

        // script
        scriptData,
        setScriptData,
        scriptTab,
        setScriptTab,
        batchList,
        setBatchList,
        handleSubmit,
        affiliateVideoFormConfig,
        setAffiliateVideoFormConfig,
        defaultVideoConfig,
      }}
    >
      {props.children}
    </AffiliateVideoContext.Provider>
  );
}

export const useAffiliateVideoContext = () => useContext(AffiliateVideoContext);
