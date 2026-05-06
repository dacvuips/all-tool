import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import {
  CACHE_KEY,
  CopyVideoAnalysisData,
  CopyVideoFormConfig,
  CopyVideoHistoryItem,
  DB_NAME,
  STORE_NAME,
} from "../../constants";

import { useTranslation } from "react-i18next";
import { useIndexedDB } from "../../hook/useIndexedDB";

/** Key used to persist the last generated script in IndexedDB */
const COPY_VIDEO_STORE_NAME = STORE_NAME.copyVideo;

interface CopyVideoContextType {
  copyVideoFormConfig?: CopyVideoFormConfig;
  patchConfig: (partial: Partial<CopyVideoFormConfig>) => void;
  /** Persist current copyVideoFormConfig to IndexedDB (call on submit only) */
  persistCopyVideoInput: () => void;
  batchRunning?: boolean;
  setBatchRunning?: (batchRunning: boolean) => void;
  DEFAULT_VIDEO_CONFIG?: CopyVideoFormConfig;

  // ── Script / analysis data ──
  scriptData: CopyVideoAnalysisData | null;
  setScriptData: (data: CopyVideoAnalysisData | null) => void;
  /** Update scriptData + persist to IndexedDB WITHOUT adding to history (for scene edits) */
  updateScriptData: (data: CopyVideoAnalysisData | null) => void;
  scriptTab: "script" | "batch";
  setScriptTab: (tab: "script" | "batch") => void;

  // ── Scene history ──
  sceneHistory: CopyVideoHistoryItem[];
  selectedHistoryId: string | null;
  selectHistoryItem: (id: string) => void;
  clearSceneHistory: () => Promise<void>;

  // ── Batch generating state ──
  batchGeneratingSceneIdsRef: React.MutableRefObject<Set<string>>;
  addBatchGeneratingSceneId: (id: string) => void;
  removeBatchGeneratingSceneId: (id: string) => void;
  batchGeneratingVideoSceneIdsRef: React.MutableRefObject<Set<string>>;
  addBatchGeneratingVideoSceneId: (id: string) => void;
  removeBatchGeneratingVideoSceneId: (id: string) => void;
  subscribeBatchState: (
    sceneId: string,
    callback: (
      generating: boolean,
      generatingVideo: boolean,
      generatingExtendVideo: boolean
    ) => void
  ) => () => void;
}

export const CopyVideoContext = createContext<Partial<CopyVideoContextType>>({
  patchConfig: () => {},
});

export function CopyVideoProvider(props) {
  const { customer } = useAuth();
  const { t } = useTranslation();
  const { LANGUAGE_OPTIONS, ART_STYLE_TRANSLATED_OPTIONS, MOOD_OPTIONS } = useOptionsTranslation();

  const DEFAULT_VIDEO_CONFIG: CopyVideoFormConfig = {
    mood: t("Vui vẻ"),
    language: LANGUAGE_OPTIONS[0].label,
    artStyle: ART_STYLE_TRANSLATED_OPTIONS[0].label,
    aspectRatio: "9:16",
    objectToPersonify: "",
  };

  // ── IndexedDB – shared cache for AI results ──
  const scriptDB = useIndexedDB<any>(COPY_VIDEO_STORE_NAME, DB_NAME.copyVideo);

  const [batchRunning, setBatchRunning] = useState(false);
  const [copyVideoFormConfig, setCopyVideoFormConfig] =
    useState<CopyVideoFormConfig>(DEFAULT_VIDEO_CONFIG);

  // ── Script / analysis data ──
  const [scriptData, setScriptDataRaw] = useState<CopyVideoAnalysisData | null>(null);
  const [scriptTab, setScriptTab] = useState<"script" | "batch">("script");

  /** Wrap setScriptData: persist to IndexedDB + add to history */
  const setScriptData = useCallback(
    (data: CopyVideoAnalysisData | null) => {
      setScriptDataRaw(data);

      if (data) {
        // 1. Persist as last script for restore-on-revisit
        scriptDB
          .set(CACHE_KEY.lastCopyVideoScript, data)
          .catch((err) => console.warn("[copy-video] Failed to persist lastCopyVideoScript", err));

        // 2. Add to history
        const now = new Date();
        const newItem: CopyVideoHistoryItem = {
          id: `copy-${Date.now()}`,
          createdAt: Date.now(),
          label: `Kịch bản – ${now.toLocaleDateString("vi-VN")} ${now.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}`,
          data,
        };
        setSceneHistory((prev) => {
          const updated = [newItem, ...prev];
          scriptDB.set(CACHE_KEY.copyVideoHistory, updated).catch(() => {});
          return updated;
        });
        setSelectedHistoryId(newItem.id);
      }
    },
    [scriptDB]
  );

  /** Update scriptData + persist to IndexedDB WITHOUT adding to history (for scene edits) */
  const updateScriptData = useCallback(
    (data: CopyVideoAnalysisData | null) => {
      setScriptDataRaw(data);
      if (data) {
        scriptDB
          .set(CACHE_KEY.lastCopyVideoScript, data)
          .catch((err) => console.warn("[copy-video] Failed to persist lastCopyVideoScript", err));
      }
    },
    [scriptDB]
  );

  // ── Scene history state ──
  const [sceneHistory, setSceneHistory] = useState<CopyVideoHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);

  // ── Batch generating state: refs + per-scene subscriptions ──
  const batchGeneratingSceneIdsRef = useRef<Set<string>>(new Set());
  const batchGeneratingVideoSceneIdsRef = useRef<Set<string>>(new Set());
  const batchSubscribersRef = useRef<
    Map<
      string,
      (generating: boolean, generatingVideo: boolean, generatingExtendVideo: boolean) => void
    >
  >(new Map());

  /** Notify a scene's subscriber of its current batch state */
  const notifySubscriber = useCallback((sceneId: string) => {
    const baseId = sceneId.replace(/::stitch$/, "");
    const cb = batchSubscribersRef.current.get(baseId);
    if (cb) {
      cb(
        batchGeneratingSceneIdsRef.current.has(baseId),
        batchGeneratingVideoSceneIdsRef.current.has(baseId),
        batchGeneratingVideoSceneIdsRef.current.has(baseId + "::stitch")
      );
    }
  }, []);

  const subscribeBatchState = useCallback(
    (
      sceneId: string,
      callback: (
        generating: boolean,
        generatingVideo: boolean,
        generatingExtendVideo: boolean
      ) => void
    ) => {
      batchSubscribersRef.current.set(sceneId, callback);
      callback(
        batchGeneratingSceneIdsRef.current.has(sceneId),
        batchGeneratingVideoSceneIdsRef.current.has(sceneId),
        batchGeneratingVideoSceneIdsRef.current.has(sceneId + "::stitch")
      );
      return () => {
        batchSubscribersRef.current.delete(sceneId);
      };
    },
    []
  );

  const addBatchGeneratingSceneId = useCallback(
    (id: string) => {
      batchGeneratingSceneIdsRef.current.add(id);
      notifySubscriber(id);
    },
    [notifySubscriber]
  );

  const removeBatchGeneratingSceneId = useCallback(
    (id: string) => {
      batchGeneratingSceneIdsRef.current.delete(id);
      notifySubscriber(id);
    },
    [notifySubscriber]
  );

  const addBatchGeneratingVideoSceneId = useCallback(
    (id: string) => {
      batchGeneratingVideoSceneIdsRef.current.add(id);
      notifySubscriber(id);
    },
    [notifySubscriber]
  );

  const removeBatchGeneratingVideoSceneId = useCallback(
    (id: string) => {
      batchGeneratingVideoSceneIdsRef.current.delete(id);
      notifySubscriber(id);
    },
    [notifySubscriber]
  );

  // ── On mount: restore last cached analysis + config from IndexedDB ──
  useEffect(() => {
    if (customer?._id) {
      restoreFromDB();
      refreshHistory();
    }
  }, [customer?._id]);

  const restoreFromDB = async () => {
    try {
      const [cachedScript, cachedConfig] = await Promise.all([
        scriptDB.get(CACHE_KEY.lastCopyVideoScript),
        scriptDB.get(CACHE_KEY.copyVideoInput),
      ]);
      if (cachedScript) setScriptDataRaw(cachedScript);
      if (cachedConfig) setCopyVideoFormConfig(cachedConfig);
    } catch (err) {
      console.warn("[copy-video] Failed to restore from IndexedDB", err);
    }
  };

  /** Refresh history list from IndexedDB */
  const refreshHistory = useCallback(async () => {
    try {
      const history: CopyVideoHistoryItem[] =
        (await scriptDB.get(CACHE_KEY.copyVideoHistory)) || [];
      setSceneHistory(history);
    } catch (err) {
      console.warn("[copy-video] Failed to load history", err);
    }
  }, [scriptDB]);

  /** Select a history item by ID and apply its data */
  const selectHistoryItem = useCallback(
    (id: string) => {
      const item = sceneHistory.find((h) => h.id === id);
      if (item) {
        setSelectedHistoryId(id);
        setScriptDataRaw(item.data);
        scriptDB.set(CACHE_KEY.lastCopyVideoScript, item.data).catch(() => {});
      }
    },
    [sceneHistory, scriptDB]
  );

  /** Clear all history */
  const clearSceneHistory = useCallback(async () => {
    await scriptDB.set(CACHE_KEY.copyVideoHistory, []);
    setSceneHistory([]);
    setSelectedHistoryId(null);
  }, [scriptDB]);

  /** Persist current copyVideoFormConfig to IndexedDB (call on submit only) */
  const persistCopyVideoInput = useCallback(() => {
    if (copyVideoFormConfig) {
      scriptDB
        .set(CACHE_KEY.copyVideoInput, copyVideoFormConfig)
        .catch((err) => console.warn("[copy-video] Failed to persist config", err));
    }
  }, [copyVideoFormConfig, scriptDB]);

  const patchConfig = (partial: Partial<CopyVideoFormConfig>) => {
    setCopyVideoFormConfig((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  };

  return (
    <CopyVideoContext.Provider
      value={{
        copyVideoFormConfig,
        patchConfig,
        persistCopyVideoInput,
        batchRunning,
        setBatchRunning,
        DEFAULT_VIDEO_CONFIG,

        // script / analysis data
        scriptData,
        setScriptData,
        updateScriptData,
        scriptTab,
        setScriptTab,

        // scene history
        sceneHistory,
        selectedHistoryId,
        selectHistoryItem,
        clearSceneHistory,

        // batch generating state
        batchGeneratingSceneIdsRef,
        addBatchGeneratingSceneId,
        removeBatchGeneratingSceneId,
        batchGeneratingVideoSceneIdsRef,
        addBatchGeneratingVideoSceneId,
        removeBatchGeneratingVideoSceneId,
        subscribeBatchState,
      }}
    >
      {props.children}
    </CopyVideoContext.Provider>
  );
}

export const useCopyVideoContext = () => useContext(CopyVideoContext);
