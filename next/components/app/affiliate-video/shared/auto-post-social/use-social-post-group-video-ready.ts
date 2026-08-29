import { useCallback, useEffect, useState } from "react";
import { DB_NAME } from "../../constants";
import type { GeneratedVideoData } from "../../elements/hook/useElementApi";
import { openIndexedDBStore } from "../../hook/useIndexedDB";
import { hasGeneratedVideoData } from "../generatedMediaUtils";

const VIDEO_STORE_NAME = "generated-videos";

/** Đếm scene trong nhóm MXH đã có video (IndexedDB). */
export function useSocialPostGroupVideoReady(sceneIds: string[]) {
  const [readyCount, setReadyCount] = useState(0);
  const sceneKey = sceneIds.join(",");

  const refresh = useCallback(async () => {
    if (sceneIds.length === 0) {
      setReadyCount(0);
      return;
    }
    const db = openIndexedDBStore<GeneratedVideoData>(VIDEO_STORE_NAME, DB_NAME.generateVideo);
    let count = 0;
    for (const id of sceneIds) {
      const video = await db.get(id);
      if (hasGeneratedVideoData(video)) count += 1;
    }
    setReadyCount(count);
  }, [sceneKey]);

  const allReady = sceneIds.length > 0 && readyCount >= sceneIds.length;

  useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    if (allReady) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [allReady, refresh]);

  return {
    readyCount,
    total: sceneIds.length,
    allReady,
    refresh,
  };
}
