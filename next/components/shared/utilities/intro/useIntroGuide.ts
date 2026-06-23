import { useCallback, useEffect, useRef, useState } from "react";

import { hasSeenIntroGuide, markIntroGuideSeen } from "./intro-guide-storage";

export type IntroGuideAutoShowMode = "on-mount" | "when-ready" | "none";

interface UseIntroGuideOptions {
  /** Tự mở tour (mặc định: true) */
  autoShow?: boolean;
  /**
   * - on-mount: sidebar — hiện 1 lần khi vào tab (component mount), lưu localStorage
   * - when-ready: batch list — hiện 1 lần khi điều kiện ready (vd. có >1 cảnh)
   * - none: chỉ mở thủ công qua nút ?
   */
  autoShowMode?: IntroGuideAutoShowMode;
  autoShowDelay?: number;
  /** when-ready: chỉ auto-show khi enabled=true */
  enabled?: boolean;
  /** when-ready: dùng 'ready' | 'not-ready' để phát hiện lần đầu đủ điều kiện */
  watchTrigger?: unknown;
}

function resolveAutoShowMode(
  mode: IntroGuideAutoShowMode | undefined,
  watchTrigger: unknown
): IntroGuideAutoShowMode {
  if (mode) return mode;
  return watchTrigger !== undefined ? "when-ready" : "on-mount";
}

export function useIntroGuide(storageKey: string, options: UseIntroGuideOptions = {}) {
  const {
    autoShow = true,
    autoShowMode,
    autoShowDelay = 600,
    enabled = true,
    watchTrigger,
  } = options;

  const resolvedMode = resolveAutoShowMode(autoShowMode, watchTrigger);
  const [introOpen, setIntroOpen] = useState(false);
  const prevWatchTriggerRef = useRef<unknown>(undefined);
  const mountAttemptedKeyRef = useRef<string | null>(null);

  /** Sidebar: auto-show 1 lần khi khách chuyển vào tab (mount), theo key localStorage */
  useEffect(() => {
    if (!autoShow || resolvedMode !== "on-mount") return;
    if (!enabled) return;
    if (hasSeenIntroGuide(storageKey)) return;
    if (mountAttemptedKeyRef.current === storageKey) return;
    mountAttemptedKeyRef.current = storageKey;

    const timer = window.setTimeout(() => {
      if (hasSeenIntroGuide(storageKey)) return;
      setIntroOpen(true);
    }, autoShowDelay);

    return () => window.clearTimeout(timer);
  }, [storageKey, autoShow, resolvedMode, autoShowDelay, enabled]);

  /** Batch list: auto-show 1 lần khi sceneCount đủ điều kiện (vd. > 1) */
  useEffect(() => {
    if (!autoShow || resolvedMode !== "when-ready") return;
    if (!enabled) return;
    if (hasSeenIntroGuide(storageKey)) return;

    const prev = prevWatchTriggerRef.current;
    const isReady = watchTrigger === "ready";

    if (prev === watchTrigger) return;

    prevWatchTriggerRef.current = watchTrigger;

    if (!isReady) return;
    if (prev === "ready") return;

    const timer = window.setTimeout(() => {
      if (hasSeenIntroGuide(storageKey)) return;
      setIntroOpen(true);
    }, autoShowDelay);

    return () => window.clearTimeout(timer);
  }, [storageKey, autoShow, resolvedMode, autoShowDelay, enabled, watchTrigger]);

  const openIntro = useCallback(() => {
    setIntroOpen(true);
  }, []);

  const handleIntroDismiss = useCallback(() => {
    markIntroGuideSeen(storageKey);
    setIntroOpen(false);
  }, [storageKey]);

  return {
    introOpen,
    openIntro,
    handleIntroDismiss,
    hasSeen: hasSeenIntroGuide(storageKey),
  };
}
