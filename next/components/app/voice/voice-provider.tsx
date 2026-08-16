import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useRouter } from "next/router";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useSettingPublic } from "../../../lib/hooks/useSettingPublic";
import { isVoiceAbortError, jobIdOf, pollVoiceJob, setVoiceAbortSignal } from "./voice-api";
import { canCreateVoice, customerIdOf, voiceCreateBlockReason } from "./voice-access";
import { getVoiceTool, parseVoiceToolId, voiceTabFromLocation, VOICE_TAB_QUERY_KEY } from "./voice-tools-config";
import {
  deleteVoiceResult,
  FEATURE_TEXT_LABEL,
  listVoiceResults,
  persistCompletedVoiceJob,
  persistLocalMedia,
  voiceOwnerIdOf,
  type VoiceResultRecord,
} from "./voice-idb";
import type { MicroxJob, VoiceToolId } from "./voice-types";

type VoiceContextValue = {
  tool: VoiceToolId;
  setTool: (tool: VoiceToolId) => void;
  credits: string;
  running: boolean;
  progress: string;
  job: MicroxJob | null;
  error: string;
  history: VoiceResultRecord[];
  generatedUrls: Record<string, string>;
  library: VoiceResultRecord[];
  canCreate: boolean;
  createBlockedReason: string;
  ownerId: string;
  run: (
    start: () => Promise<MicroxJob>,
    meta?: { voiceId?: string; sourceFile?: File; feature?: string }
  ) => Promise<MicroxJob | null>;
  runLocal: (
    task: (onProgress: (message: string) => void) => Promise<void>
  ) => Promise<boolean>;
  saveLocalMedia: (input: {
    blob: Blob;
    mimeType?: string;
    name?: string;
    texts?: { label: string; value: string }[];
  }) => Promise<VoiceResultRecord | null>;
  saveLocalMediaBatch: (
    items: {
      blob: Blob;
      mimeType?: string;
      name?: string;
      texts?: { label: string; value: string }[];
    }[]
  ) => Promise<number>;
  removeHistory: (id: string) => Promise<void>;
  cancelRun: () => void;
};

const VoiceContext = createContext<VoiceContextValue | null>(null);

function revokeUrls(map: Record<string, string>) {
  Object.values(map).forEach((url) => {
    try {
      URL.revokeObjectURL(url);
    } catch {
      // ignore
    }
  });
}

function urlsFromResults(list: VoiceResultRecord[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const item of list) {
    const voiceId = String(item.voiceId || "").trim();
    const blob = item.blobs?.[0];
    if (!voiceId || !blob || map[voiceId]) continue;
    map[voiceId] = URL.createObjectURL(blob);
  }
  return map;
}

export function VoiceProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { customer, loadCustomer } = useAuth();
  const blockSetting = useSettingPublic("pa-b-page");
  const marketplaceStopped = Boolean(blockSetting?.key);
  const createBlockedReason = voiceCreateBlockReason(customer, marketplaceStopped);
  const canCreate = canCreateVoice(customer, marketplaceStopped);
  const ownerId = voiceOwnerIdOf(customerIdOf(customer));
  const [tool, setToolState] = useState<VoiceToolId>(
    () => parseVoiceToolId(router.query[VOICE_TAB_QUERY_KEY]) || voiceTabFromLocation() || "tts"
  );
  const credits = useMemo(() => {
    const count = customer?.googlePackage?.textCreditCount ?? 0;
    const limit = customer?.googlePackage?.textCreditLimit ?? 0;
    if (limit === -1) return `${count} / ∞`;
    return `${count} / ${limit}`;
  }, [customer?.googlePackage?.textCreditCount, customer?.googlePackage?.textCreditLimit]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState("");
  const [job, setJob] = useState<MicroxJob | null>(null);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<VoiceResultRecord[]>([]);
  const [generatedUrls, setGeneratedUrls] = useState<Record<string, string>>({});
  const [library, setLibrary] = useState<VoiceResultRecord[]>([]);
  const generatedRef = useRef<Record<string, string>>({});
  const abortRef = useRef<AbortController | null>(null);

  const throwIfAborted = () => {
    if (abortRef.current?.signal.aborted) {
      throw new DOMException("Đã dừng", "AbortError");
    }
  };

  const refreshGenerated = useCallback(async (nextOwnerId = ownerId) => {
    try {
      const all = await listVoiceResults(nextOwnerId);
      setLibrary(
        all.filter(
          (item) => item.tool !== "cut" && (item.blobs?.length || item.urls?.length)
        )
      );
      const next = urlsFromResults(all);
      revokeUrls(generatedRef.current);
      generatedRef.current = next;
      setGeneratedUrls(next);
    } catch {
      revokeUrls(generatedRef.current);
      generatedRef.current = {};
      setGeneratedUrls({});
      setLibrary([]);
    }
  }, [ownerId]);

  const refreshHistory = useCallback(
    async (toolId: VoiceToolId, nextOwnerId = ownerId) => {
      try {
        const perTab = toolId !== "mine" && toolId !== "voices";
        const list = await listVoiceResults(nextOwnerId, perTab ? toolId : undefined);
        setHistory(perTab ? list : []);
      } catch {
        setHistory([]);
      }
      await refreshGenerated(nextOwnerId);
    },
    [ownerId, refreshGenerated]
  );

  useEffect(() => {
    void refreshHistory(tool, ownerId);
  }, [tool, ownerId, refreshHistory]);

  const writeVoiceTab = useCallback(
    (next: VoiceToolId) => {
      if (!router.isReady) return;
      if (router.query[VOICE_TAB_QUERY_KEY] === next) return;
      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, [VOICE_TAB_QUERY_KEY]: next },
        },
        undefined,
        { shallow: true }
      );
    },
    [router]
  );

  useEffect(() => {
    if (!router.isReady) return;
    const parsed = parseVoiceToolId(router.query[VOICE_TAB_QUERY_KEY]);
    if (!parsed) {
      writeVoiceTab(tool);
      return;
    }
    if (parsed === tool) return;
    setToolState(parsed);
    setJob(null);
    setError("");
  }, [router.isReady, router.query[VOICE_TAB_QUERY_KEY]]);

  const setTool = useCallback(
    (next: VoiceToolId) => {
      setToolState(next);
      setJob(null);
      setError("");
      setProgress("");
      writeVoiceTab(next);
    },
    [writeVoiceTab]
  );

  const cancelRun = useCallback(() => {
    abortRef.current?.abort();
    setVoiceAbortSignal(null);
    setRunning(false);
    setProgress("");
    setError("");
    void import("../../video-affiliate-plus/ffmpeg-browser")
      .then((mod) => mod.abortFfmpegBrowser())
      .catch(() => undefined);
  }, []);

  const run = useCallback(
    async (start: () => Promise<MicroxJob>, meta?: { voiceId?: string; sourceFile?: File; feature?: string }) => {
      if (!canCreate) {
        setError(t(createBlockedReason || "Không thể tạo giọng"));
        return null;
      }
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setVoiceAbortSignal(ac.signal);
      setRunning(true);
      setError("");
      try {
        throwIfAborted();
        const created = await start();
        throwIfAborted();
        setJob(created);
        const id = jobIdOf(created);
        const status = String(created?.status || "").toLowerCase();
        let done = created;
        if (id && status !== "completed" && status !== "failed") {
          done = await pollVoiceJob(id, setJob, ac.signal, tool);
          throwIfAborted();
          setJob(done);
        }
        if (String(done?.status || "").toLowerCase() === "failed") {
          throw new Error(t("Job thất bại"));
        }
        throwIfAborted();
        await persistCompletedVoiceJob(done, tool, ownerId, meta?.voiceId, meta?.sourceFile, [
          { label: FEATURE_TEXT_LABEL, value: meta?.feature || getVoiceTool(tool).labelKey },
        ]);
        await refreshHistory(tool, ownerId);
        try {
          await loadCustomer();
        } catch {
          // ignore
        }
        return done;
      } catch (err: any) {
        if (isVoiceAbortError(err) || ac.signal.aborted) {
          setError("");
          return null;
        }
        setError(t(err?.message || "Lỗi"));
        return null;
      } finally {
        if (abortRef.current === ac) {
          setVoiceAbortSignal(null);
          abortRef.current = null;
          setRunning(false);
        }
      }
    },
    [canCreate, createBlockedReason, tool, ownerId, refreshHistory, loadCustomer, t]
  );

  const runLocal = useCallback(
    async (task: (onProgress: (message: string) => void) => Promise<void>) => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      setVoiceAbortSignal(ac.signal);
      setRunning(true);
      setError("");
      setProgress("");
      try {
        await task((message) => {
          if (ac.signal.aborted) throw new DOMException("Đã dừng", "AbortError");
          setProgress(message);
        });
        if (ac.signal.aborted) throw new DOMException("Đã dừng", "AbortError");
        return true;
      } catch (err: any) {
        if (isVoiceAbortError(err) || ac.signal.aborted) {
          setError("");
          return false;
        }
        setError(t(err?.message || "Lỗi"));
        return false;
      } finally {
        if (abortRef.current === ac) {
          setVoiceAbortSignal(null);
          abortRef.current = null;
          setRunning(false);
          setProgress("");
        }
      }
    },
    [t]
  );

  const saveLocalMedia = useCallback(
    async (input: {
      blob: Blob;
      mimeType?: string;
      name?: string;
      texts?: { label: string; value: string }[];
    }) => {
      if (!ownerId) {
        setError(t("Vui lòng đăng nhập"));
        return null;
      }
      const record = await persistLocalMedia({
        ownerId,
        tool,
        blob: input.blob,
        mimeType: input.mimeType,
        name: input.name,
        texts: [
          ...(input.texts?.some((row) => row.label === FEATURE_TEXT_LABEL)
            ? []
            : [{ label: FEATURE_TEXT_LABEL, value: getVoiceTool(tool).labelKey }]),
          ...(input.texts || []),
        ],
      });
      await refreshHistory(tool, ownerId);
      return record;
    },
    [ownerId, tool, refreshHistory, t]
  );

  const saveLocalMediaBatch = useCallback(
    async (
      items: {
        blob: Blob;
        mimeType?: string;
        name?: string;
        texts?: { label: string; value: string }[];
      }[]
    ) => {
      if (!ownerId) {
        setError(t("Vui lòng đăng nhập"));
        return 0;
      }
      let count = 0;
      for (const item of items) {
        const record = await persistLocalMedia({
          ownerId,
          tool,
          blob: item.blob,
          mimeType: item.mimeType,
          name: item.name,
          texts: [
            ...(item.texts?.some((row) => row.label === FEATURE_TEXT_LABEL)
              ? []
              : [{ label: FEATURE_TEXT_LABEL, value: getVoiceTool(tool).labelKey }]),
            ...(item.texts || []),
          ],
        });
        if (record) count += 1;
      }
      await refreshHistory(tool, ownerId);
      return count;
    },
    [ownerId, tool, refreshHistory, t]
  );

  const removeHistory = useCallback(
    async (id: string) => {
      await deleteVoiceResult(id);
      setJob((current) => {
        const jid = jobIdOf(current);
        if (!jid) return current;
        if (id === jid || id.endsWith(`::${jid}`)) return null;
        return current;
      });
      await refreshHistory(tool, ownerId);
    },
    [tool, ownerId, refreshHistory]
  );

  const value = useMemo(
    () => ({
      tool,
      setTool,
      credits,
      running,
      progress,
      job,
      error,
      history,
      generatedUrls,
      library,
      canCreate,
      createBlockedReason,
      ownerId,
      run,
      runLocal,
      saveLocalMedia,
      saveLocalMediaBatch,
      removeHistory,
      cancelRun,
    }),
    [
      tool,
      setTool,
      credits,
      running,
      progress,
      job,
      error,
      history,
      generatedUrls,
      library,
      canCreate,
      createBlockedReason,
      ownerId,
      run,
      runLocal,
      saveLocalMedia,
      saveLocalMediaBatch,
      removeHistory,
      cancelRun,
    ]
  );

  useEffect(() => {
    return () => revokeUrls(generatedRef.current);
  }, []);

  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}

export function useVoiceContext() {
  const ctx = useContext(VoiceContext);
  if (!ctx) throw new Error("useVoiceContext must be used within VoiceProvider");
  return ctx;
}
