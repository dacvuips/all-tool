/**
 * Provider + history IndexedDB cho tab Xóa Logo AI
 */
import {
  createContext,
  Dispatch,
  ReactNode,
  SetStateAction,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { CACHE_KEY, DB_NAME, STORE_NAME, uid } from "../../constants";
import { useIndexedDB } from "../../hook/useIndexedDB";
import { RemoveLogoHistoryItem, RemoveLogoUploadItem } from "../constants";

type RemoveLogoContextValue = {
  uploads: RemoveLogoUploadItem[];
  setUploads: Dispatch<SetStateAction<RemoveLogoUploadItem[]>>;
  history: RemoveLogoHistoryItem[];
  running: boolean;
  setRunning: (v: boolean) => void;
  addHistoryItems: (items: RemoveLogoHistoryItem[]) => Promise<void>;
  removeHistoryItem: (id: string) => Promise<void>;
  clearHistory: () => Promise<void>;
  historyLoaded: boolean;
};

const RemoveLogoContext = createContext<RemoveLogoContextValue | null>(null);

export function RemoveLogoProvider({ children }: { children: ReactNode }) {
  const [uploads, setUploads] = useState<RemoveLogoUploadItem[]>([]);
  const [history, setHistory] = useState<RemoveLogoHistoryItem[]>([]);
  const [running, setRunning] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const db = useIndexedDB<RemoveLogoHistoryItem[]>(
    STORE_NAME.removeLogoHistory,
    DB_NAME.removeLogo
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await db.get(CACHE_KEY.removeLogoHistory);
        if (!cancelled && Array.isArray(saved)) {
          setHistory(saved);
        }
      } catch (err) {
        console.warn("[remove-logo] load history failed", err);
      } finally {
        if (!cancelled) setHistoryLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const addHistoryItems = useCallback(
    async (items: RemoveLogoHistoryItem[]) => {
      if (!items.length) return;
      setHistory((prev) => {
        const next = [...items, ...prev].slice(0, 100);
        void db.set(CACHE_KEY.removeLogoHistory, next).catch((err) => {
          console.warn("[remove-logo] persist history failed", err);
        });
        return next;
      });
    },
    [db]
  );

  const removeHistoryItem = useCallback(
    async (id: string) => {
      setHistory((prev) => {
        const next = prev.filter((h) => h.id !== id);
        void db.set(CACHE_KEY.removeLogoHistory, next).catch((err) => {
          console.warn("[remove-logo] persist history failed", err);
        });
        return next;
      });
    },
    [db]
  );

  const clearHistory = useCallback(async () => {
    setHistory([]);
    try {
      await db.set(CACHE_KEY.removeLogoHistory, []);
    } catch (err) {
      console.warn("[remove-logo] clear history failed", err);
    }
  }, [db]);

  const value = useMemo(
    () => ({
      uploads,
      setUploads,
      history,
      running,
      setRunning,
      addHistoryItems,
      removeHistoryItem,
      clearHistory,
      historyLoaded,
    }),
    [
      uploads,
      history,
      running,
      addHistoryItems,
      removeHistoryItem,
      clearHistory,
      historyLoaded,
    ]
  );

  return <RemoveLogoContext.Provider value={value}>{children}</RemoveLogoContext.Provider>;
}

export function useRemoveLogoContext() {
  const ctx = useContext(RemoveLogoContext);
  if (!ctx) {
    throw new Error("useRemoveLogoContext must be used within RemoveLogoProvider");
  }
  return ctx;
}

export { uid };
