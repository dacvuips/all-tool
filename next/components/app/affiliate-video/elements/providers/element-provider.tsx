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
  ElementScriptTabEnum,
  STORE_NAME,
} from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { applyHistoryRename } from "../../shared/scene-history-dropdown";
import {
  SceneErrorKind,
  SceneErrors,
  useSceneErrorBroadcast,
} from "../../hook/useSceneErrorBroadcast";
import {
  SceneProgress,
  SceneProgressKind,
  useSceneProgressBroadcast,
} from "../../hook/useSceneProgressBroadcast";
import { useSceneJobBroadcast } from "../../hook/useSceneJobBroadcast";
import { syncSidebarPatchToCurrentScript } from "../../shared/syncSidebarPatchToCurrentScript";
import { ensureTabSceneLists } from "../../shared/script-tab-scenes";
import { ActionImageEnum, ServiceImageEnum } from "../constants";

/** Key used to persist the last generated script in IndexedDB */
const ELEMENT_STORE_NAME = STORE_NAME.generateElement;

const ELEMENT_SCRIPT_TAB_KEY = "element-script-tab";

/** Migrate legacy single artStyleImg to array. */
function normalizeElementFormConfig(config: ElementFormConfig): ElementFormConfig {
  const raw = config.artStyleImg as ElementFormImage | ElementFormImage[] | undefined;
  const withServiceImageType = {
    ...config,
    serviceImageType: config.serviceImageType ?? ServiceImageEnum.imageOnly,
  };
  if (raw != null && !Array.isArray(raw)) {
    return { ...withServiceImageType, artStyleImg: [raw] };
  }
  return withServiceImageType;
}

function readStoredScriptTab(): ElementScriptTabEnum {
  if (typeof window === "undefined") return ElementScriptTabEnum.batch;
  const saved = sessionStorage.getItem(ELEMENT_SCRIPT_TAB_KEY);
  return Object.values(ElementScriptTabEnum).includes(saved as ElementScriptTabEnum)
    ? (saved as ElementScriptTabEnum)
    : ElementScriptTabEnum.batch;
}

interface ElementContextType {
  elementFormConfig?: ElementFormConfig;
  patchConfig: (partial: Partial<ElementFormConfig>) => void;
  /** Persist current copyVideoFormConfig to IndexedDB (call on submit only) */
  persistElementInput: () => void;
  batchRunning?: boolean;
  setBatchRunning?: (batchRunning: boolean) => void;
  DEFAULT_ELEMENT_CONFIG?: ElementFormConfig;

  // ── Script / analysis data ──
  scriptData: ElementAnalysisData | null;
  setScriptData: (data: ElementAnalysisData | null) => void;
  /** Update scriptData + persist to IndexedDB WITHOUT adding to history (for scene edits) */
  updateScriptData: (data: ElementAnalysisData | null) => void;
  scriptTab: ElementScriptTabEnum;
  setScriptTab: (tab: ElementScriptTabEnum) => void;

  // ── Scene history ──
  sceneHistory: ElementHistoryItem[];
  selectedHistoryId: string | null;
  selectHistoryItem: (id: string) => void;
  clearSceneHistory: () => Promise<void>;
  renameHistoryItem: (id: string, label: string) => Promise<void>;

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
  getSceneErrors: (sceneId: string) => SceneErrors;
  reportSceneProgress: (
    sceneId: string,
    kind: SceneProgressKind,
    progress: number | null
  ) => void;
  subscribeSceneProgress: (
    sceneId: string,
    callback: (progress: SceneProgress) => void
  ) => () => void;
  registerSceneJob: (
    sceneId: string,
    kind: SceneProgressKind,
    jobId: string | null
  ) => void;
  getSceneJob: (sceneId: string, kind: SceneProgressKind) => string | undefined;
}

export const ElementContext = createContext<Partial<ElementContextType>>({
  patchConfig: () => {},
});

export function ElementProvider(props) {
  const { customer } = useAuth();
  const { t } = useTranslation();

  const DEFAULT_ELEMENT_CONFIG: ElementFormConfig = {
    prompt: "",
    aspectRatio: "16:9",
    artStyle: "",
    artStyleId: "",
    serviceImageType: ServiceImageEnum.imageOnly,
    actionImageType: ActionImageEnum.auto,
  };

  // ── IndexedDB – shared cache for AI results ──
  const scriptDB = useIndexedDB<any>(ELEMENT_STORE_NAME, DB_NAME.generateElement);

  const [batchRunning, setBatchRunning] = useState(false);
  const [elementFormConfig, setElementFormConfig] =
    useState<ElementFormConfig>(DEFAULT_ELEMENT_CONFIG);

  // ── Script / analysis data ──
  const [scriptData, setScriptDataRaw] = useState<ElementAnalysisData | null>(null);
  const [scriptTab, setScriptTabState] = useState<ElementScriptTabEnum>(readStoredScriptTab);

  const setScriptTab = useCallback((tab: ElementScriptTabEnum) => {
    setScriptTabState(tab);
    if (typeof window !== "undefined") {
      sessionStorage.setItem(ELEMENT_SCRIPT_TAB_KEY, tab);
    }
  }, []);

  /** Wrap setScriptData: persist to IndexedDB + add to history */
  const setScriptData = useCallback(
    (data: ElementAnalysisData | null) => {
      setScriptDataRaw(data);

      if (data) {
        // 1. Persist as last script for restore-on-revisit
        scriptDB
          .set(CACHE_KEY.lastElementScript, data)
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
  const { reportSceneError, subscribeSceneError, getSceneErrors } = useSceneErrorBroadcast();
  const { reportSceneProgress, subscribeSceneProgress } = useSceneProgressBroadcast();
  const { registerSceneJob, getSceneJob } = useSceneJobBroadcast();

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
      const normalizedConfig = cachedConfig
        ? normalizeElementFormConfig(cachedConfig)
        : undefined;
      if (cachedScript) {
        const script = ensureTabSceneLists(cachedScript);
        setScriptDataRaw(
          normalizedConfig?.serviceImageType
            ? { ...script, serviceImageType: normalizedConfig.serviceImageType }
            : script
        );
      }
      if (normalizedConfig) setElementFormConfig(normalizedConfig);
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
        setScriptDataRaw(ensureTabSceneLists(item.data));
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

  /** Rename a history item and persist */
  const renameHistoryItem = useCallback(
    async (id: string, label: string) => {
      const next = applyHistoryRename(sceneHistory, id, label);
      if (!next) return;
      setSceneHistory(next);
      try {
        await scriptDB.set(CACHE_KEY.elementHistory, next);
      } catch (err) {
        console.warn("[element] Failed to rename history", err);
      }
    },
    [sceneHistory, scriptDB]
  );

  /** Persist current copyVideoFormConfig to IndexedDB (call on submit only) */
  const persistElementInput = useCallback(() => {
    if (elementFormConfig) {
      scriptDB
        .set(CACHE_KEY.elementInput, elementFormConfig)
        .catch((err) => console.warn("[element] Failed to persist config", err));
    }
  }, [elementFormConfig, scriptDB]);

  const patchConfig = useCallback(
    (partial: Partial<ElementFormConfig>) => {
      setElementFormConfig((prev) => ({ ...prev, ...partial }));

      if (partial.aspectRatio !== undefined || partial.serviceImageType !== undefined) {
        syncSidebarPatchToCurrentScript({
          patch: {
            ...(partial.aspectRatio !== undefined && { aspectRatio: partial.aspectRatio }),
            ...(partial.serviceImageType !== undefined && {
              serviceImageType: partial.serviceImageType,
            }),
          },
          setScriptData: setScriptDataRaw,
          selectedHistoryId,
          setSceneHistory,
          scriptDB,
          lastScriptCacheKey: CACHE_KEY.lastElementScript,
          historyCacheKey: CACHE_KEY.elementHistory,
          logTag: "element",
        });
      }
    },
    [scriptDB, selectedHistoryId]
  );

  return (
    <ElementContext.Provider
      value={{
        elementFormConfig,
        patchConfig,
        persistElementInput,
        batchRunning,
        setBatchRunning,
        DEFAULT_ELEMENT_CONFIG,

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
        renameHistoryItem,

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
        getSceneErrors,
        reportSceneProgress,
        subscribeSceneProgress,
        registerSceneJob,
        getSceneJob,
      }}
    >
      {props.children}
    </ElementContext.Provider>
  );
}

export const useElementContext = () => useContext(ElementContext);
