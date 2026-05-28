import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import {
  CACHE_KEY,
  DB_NAME,
  ElementAnalysisData,
  ElementFormConfig,
  ElementFormImage,
  ElementHistoryItem,
  STORE_NAME,
} from "../../constants";
import { ServiceImageEnum } from "../../elements/constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import {
  SceneErrorKind,
  SceneErrors,
  useSceneErrorBroadcast,
} from "../../hook/useSceneErrorBroadcast";
import {
  ReviewAnalysisData,
  ReviewFormConfig,
  ReviewHistoryItem,
  ReviewScriptTabEnum,
} from "../constants";

/** Key used to persist the last generated script in IndexedDB */
const REVIEW_STORE_NAME = STORE_NAME.generateReview;

const REVIEW_SCRIPT_TAB_KEY = "review-script-tab";

/** Migrate legacy single artStyleImg to array. */
function normalizeReviewFormConfig(config: ReviewFormConfig): ReviewFormConfig {
  const raw = config.artStyleImg as ElementFormImage | ElementFormImage[] | undefined;
  if (raw != null && !Array.isArray(raw)) {
    return { ...config, artStyleImg: [raw] };
  }
  return config;
}

function readStoredScriptTab(): ReviewScriptTabEnum {
  if (typeof window === "undefined") return ReviewScriptTabEnum.batch;
  const saved = sessionStorage.getItem(REVIEW_SCRIPT_TAB_KEY);
  return Object.values(ReviewScriptTabEnum).includes(saved as ReviewScriptTabEnum)
    ? (saved as ReviewScriptTabEnum)
    : ReviewScriptTabEnum.batch;
}

interface ReviewContextType {
  reviewFormConfig?: ReviewFormConfig;
  patchConfig: (partial: Partial<ReviewFormConfig>) => void;
  /** Persist current reviewFormConfig to IndexedDB (call on submit only) */
  persistReviewInput: () => void;
  batchRunning?: boolean;
  setBatchRunning?: (batchRunning: boolean) => void;
  DEFAULT_REVIEW_CONFIG?: ReviewFormConfig;
  scriptData: ReviewAnalysisData | null;
  setScriptData: (data: ReviewAnalysisData | null) => void;

  updateScriptData: (data: ReviewAnalysisData | null) => void;
  scriptTab: ReviewScriptTabEnum;
  setScriptTab: (tab: ReviewScriptTabEnum) => void;
  // ── Scene history ──
  sceneHistory: ReviewHistoryItem[];
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
  /** Báo lỗi inline cho 1 scene (dùng cho batch/single generation) */
  reportSceneError: (sceneId: string, kind: SceneErrorKind, message: string | null) => void;
  /** Subscribe state lỗi inline cho 1 scene */
  subscribeSceneError: (sceneId: string, callback: (errors: SceneErrors) => void) => () => void;
}

export const ReviewContext = createContext<Partial<ReviewContextType>>({
  patchConfig: () => {},
});

export function ReviewProvider(props) {
  const { customer } = useAuth();
  const { t } = useTranslation();

  const DEFAULT_REVIEW_CONFIG: ReviewFormConfig = {
    prompt: "",
    aspectRatio: "16:9",
    artStyle: "",
    artStyleId: "",
    serviceImageType: ServiceImageEnum.imageOnly,
  };

  // ── IndexedDB – shared cache for AI results ──
  const scriptDB = useIndexedDB<any>(REVIEW_STORE_NAME, DB_NAME.generateReview);

  const [batchRunning, setBatchRunning] = useState(false);
  const [reviewFormConfig, setReviewFormConfig] =
    useState<ElementFormConfig>(DEFAULT_REVIEW_CONFIG);

  // ── Script / analysis data ──
  const [scriptData, setScriptDataRaw] = useState<ReviewAnalysisData | null>(null);
  const [scriptTab, setScriptTabState] = useState<ReviewScriptTabEnum>(readStoredScriptTab);

  const setScriptTab = useCallback((tab: ReviewScriptTabEnum) => {
    setScriptTabState(tab);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(REVIEW_SCRIPT_TAB_KEY, tab);
    }
  }, []);

  /** Wrap setScriptData: persist to IndexedDB + add to history */
  const setScriptData = useCallback(
    (data: ReviewAnalysisData | null) => {
      setScriptDataRaw(data);

      if (data) {
        // 1. Persist as last script for restore-on-revisit
        scriptDB
          .set(CACHE_KEY.lastReviewScript, data)
          .catch((err) => console.warn("[element] Failed to persist lastElementScript", err));

        // 2. Add to history
        const now = new Date();
        const newItem: ElementHistoryItem = {
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
          scriptDB.set(CACHE_KEY.elementHistory, updated).catch(() => {});
          return updated;
        });
        setSelectedHistoryId(newItem.id);
      }
    },
    [scriptDB]
  );

  /** Update scriptData + persist to IndexedDB WITHOUT adding to history (for scene edits) */
  const updateScriptData = useCallback(
    (data: ElementAnalysisData | null) => {
      setScriptDataRaw(data);
      if (data) {
        scriptDB
          .set(CACHE_KEY.lastElementScript, data)
          .catch((err) => console.warn("[element] Failed to persist lastElementScript", err));
      }
    },
    [scriptDB]
  );

  // ── Scene history state ──
  const [sceneHistory, setSceneHistory] = useState<ElementHistoryItem[]>([]);
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

  // ── Per-scene inline error broadcast (batch generation failures) ──
  const { reportSceneError, subscribeSceneError } = useSceneErrorBroadcast();

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
        scriptDB.get(CACHE_KEY.lastElementScript),
        scriptDB.get(CACHE_KEY.elementInput),
      ]);
      if (cachedScript) setScriptDataRaw(cachedScript);
      if (cachedConfig) setReviewFormConfig(normalizeReviewFormConfig(cachedConfig));
    } catch (err) {
      console.warn("[element] Failed to restore from IndexedDB", err);
    }
  };

  /** Refresh history list from IndexedDB */
  const refreshHistory = useCallback(async () => {
    try {
      const history: ElementHistoryItem[] = (await scriptDB.get(CACHE_KEY.elementHistory)) || [];
      setSceneHistory(history);
    } catch (err) {
      console.warn("[element] Failed to load history", err);
    }
  }, [scriptDB]);

  /** Select a history item by ID and apply its data */
  const selectHistoryItem = useCallback(
    (id: string) => {
      const item = sceneHistory.find((h) => h.id === id);
      if (item) {
        setSelectedHistoryId(id);
        setScriptDataRaw(item.data);
        scriptDB.set(CACHE_KEY.lastElementScript, item.data).catch(() => {});
      }
    },
    [sceneHistory, scriptDB]
  );

  /** Clear all history */
  const clearSceneHistory = useCallback(async () => {
    await scriptDB.set(CACHE_KEY.elementHistory, []);
    setSceneHistory([]);
    setSelectedHistoryId(null);
  }, [scriptDB]);

  /** Persist current copyVideoFormConfig to IndexedDB (call on submit only) */
  const persistReviewInput = useCallback(() => {
    if (reviewFormConfig) {
      scriptDB
        .set(CACHE_KEY.reviewInput, reviewFormConfig)
        .catch((err) => console.warn("[review] Failed to persist config", err));
    }
  }, [reviewFormConfig, scriptDB]);

  const patchConfig = (partial: Partial<ReviewFormConfig>) => {
    setReviewFormConfig((prev) => {
      const next = { ...prev, ...partial };
      return next;
    });
  };

  return (
    <ReviewContext.Provider
      value={{
        reviewFormConfig,
        patchConfig,
        persistReviewInput,
        batchRunning,
        setBatchRunning,
        DEFAULT_REVIEW_CONFIG,

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
        reportSceneError,
        subscribeSceneError,
      }}
    >
      {props.children}
    </ReviewContext.Provider>
  );
}

export const useReviewContext = () => useContext(ReviewContext);
