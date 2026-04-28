import { createContext, useContext, useState } from "react";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { CACHE_KEY, CopyVideoFormConfig, DB_NAME, STORE_NAME } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";

/** Key used to persist the last generated script in IndexedDB */

interface CopyVideoContextType {
  copyVideoFormConfig?: CopyVideoFormConfig;
  patchConfig: (partial: Partial<CopyVideoFormConfig>) => void;
  batchRunning?: boolean;
  setBatchRunning?: (batchRunning: boolean) => void;
}
export const CopyVideoContext = createContext<CopyVideoContextType>({
  patchConfig: () => {},
});

export function CopyVideoProvider(props) {
  const [batchRunning, setBatchRunning] = useState(false);
  const { DEFAULT_VIDEO_CONFIG } = useOptionsTranslation();
  // ── IndexedDB – shared cache for AI results ──
  const scriptDB = useIndexedDB<any>(STORE_NAME.copyVideo, DB_NAME.copyVideo);

  const [copyVideoFormConfig, setCopyVideoFormConfig] =
    useState<CopyVideoFormConfig>(DEFAULT_VIDEO_CONFIG);

  /** Persist config to IndexedDB */
  const persistConfig = (config: CopyVideoFormConfig) => {
    scriptDB
      .set(CACHE_KEY.generateInput, config)
      .catch((err) => console.warn("[affiliate-video] Failed to persist config", err));
  };
  const patchConfig = (partial: Partial<CopyVideoFormConfig>) => {
    setCopyVideoFormConfig((prev) => {
      const next = { ...prev, ...partial };

      persistConfig(next);
      return next;
    });
  };
  return (
    <CopyVideoContext.Provider
      value={{
        copyVideoFormConfig,
        patchConfig,
        batchRunning,
        setBatchRunning,
      }}
    >
      {props.children}
    </CopyVideoContext.Provider>
  );
}

export const useCopyVideoContext = () => useContext(CopyVideoContext);
