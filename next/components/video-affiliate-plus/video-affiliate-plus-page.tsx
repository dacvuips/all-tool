import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft } from "react-icons/hi";
import { RiVideoAddLine } from "react-icons/ri";
import { useScreen } from "../../lib/hooks/useScreen";
import { TabGroup } from "../shared/utilities/tab/tab-group";
import { ShopeeUploadFlowPanel } from "../shopee-video-upload/panels/upload-flow-panel";
import {
  clearGenerateVideoIndexedDb,
  deleteImportHistorySession,
  ensureImportHistoryFromItems,
  getImportHistory,
  getSelectedImportHistoryId,
  ImportHistoryItem,
  migrateLegacyImportHistory,
  pushImportHistory,
  setSelectedImportHistoryId,
  updateImportHistoryCount,
} from "./import-history";
import { hydrateMergedVideoUrls } from "./merged-video";
import { LogsPanel } from "./panels/logs-panel";
import { ProxiesPanel } from "./panels/proxies-panel";
import { ScrapeDataPanel } from "./panels/scrape-data-panel";
import { SettingsPanel } from "./panels/settings-panel";
import { ThreadManagementPanel } from "./panels/thread-management-panel";
import { UsersPanel } from "./panels/users-panel";
import {
  appendLog,
  loadItems,
  loadLogs,
  loadProxies,
  loadSettings,
  loadUsers,
  saveItems,
  saveLogs,
  saveProxies,
  saveSettings,
  saveUsers,
} from "./storage";
import { DEFAULT_SESSION_ID, getSessionItems, replaceSessionThreads } from "./thread-store";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusProxy,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  getTotalVideos,
  ThreadStatus,
} from "./types";

const VIDEO_AFFILIATE_TAB_KEYS = [
  "scrape",
  "generate",
  "upload",
  "users",
  "proxies",
  "logs",
  "settings",
] as const;

function getVideoAffiliateTabIndex(tab: string | string[] | undefined): number {
  const value = Array.isArray(tab) ? tab[0] : tab;
  if (!value) return 1;

  const numeric = Number(value);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < VIDEO_AFFILIATE_TAB_KEYS.length) {
    return numeric;
  }

  const key = value.toLowerCase();
  const aliases: Record<string, number> = {
    crawl: 0,
    data: 0,
    scrape: 0,
    generate: 1,
    threads: 1,
    thread: 1,
    upload: 2,
    post: 2,
    shopee: 2,
    shope: 2,
    users: 3,
    user: 3,
    proxies: 4,
    proxy: 4,
    logs: 5,
    log: 5,
    settings: 6,
    setting: 6,
  };

  return aliases[key] ?? 1;
}

function simulateTick(items: AffiliatePlusItem[]): AffiliatePlusItem[] {
  return items.map((item) => {
    // Đang chờ job Flow2 thật — không simulate
    if (item.countdown >= 90000 && (item.status === "running" || item.status === "uploading")) {
      return item;
    }
    if (item.status !== "running" && item.status !== "uploading") return item;

    let countdown = item.countdown - 1;
    if (countdown > 0) {
      return { ...item, countdown, status: "running" as ThreadStatus };
    }

    const total = getTotalVideos(item);
    const failChance = Math.random() < 0.08;

    if (failChance && item.pending > 0) {
      return {
        ...item,
        status: "error" as ThreadStatus,
        error: "createPost failed: getExtra failed: Post too many...",
        countdown: 0,
      };
    }

    if (item.pending <= 0) {
      return {
        ...item,
        status: "success" as ThreadStatus,
        uploaded: total,
        pending: 0,
        countdown: 0,
      };
    }

    const newUploaded = Math.min(item.uploaded + 1, total);
    const newPending = Math.max(item.pending - 1, 0);
    const nextDelay =
      item.delayMin + Math.floor(Math.random() * Math.max(item.delayMax - item.delayMin, 1));

    return {
      ...item,
      status: newPending === 0 ? ("success" as ThreadStatus) : ("uploading" as ThreadStatus),
      uploaded: newUploaded,
      pending: newPending,
      countdown: newPending > 0 ? nextDelay : 0,
      error: "",
    };
  });
}

export default function VideoAffiliatePlusPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");

  const [activeTab, setActiveTab] = useState(1);
  const [items, setItems] = useState<AffiliatePlusItem[]>([]);
  const [users, setUsers] = useState<AffiliatePlusUser[]>([]);
  const [proxies, setProxies] = useState<AffiliatePlusProxy[]>([]);
  const [logs, setLogs] = useState<AffiliatePlusLog[]>([]);
  const [settings, setSettings] = useState<AffiliatePlusSettings>(loadSettings());
  const [importHistory, setImportHistory] = useState<ImportHistoryItem[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | null>(null);
  const itemsRef = useRef(items);
  const selectedHistoryIdRef = useRef<string | null>(null);
  const skipCountSyncRef = useRef(false);
  const countSyncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  selectedHistoryIdRef.current = selectedHistoryId;

  useEffect(() => {
    if (!router.isReady) return;
    setActiveTab(getVideoAffiliateTabIndex(router.query.tab));
  }, [router.isReady, router.query.tab]);

  const handleTabChange = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(VIDEO_AFFILIATE_TAB_KEYS.length - 1, index));
      const tab = VIDEO_AFFILIATE_TAB_KEYS[nextIndex];
      setActiveTab(nextIndex);

      void router.replace(
        {
          pathname: router.pathname,
          query: { ...router.query, tab },
        },
        undefined,
        { shallow: true, scroll: false }
      );
    },
    [router]
  );

  const refreshImportHistory = useCallback(async () => {
    try {
      const history = await getImportHistory();
      setImportHistory(history);
    } catch (err) {
      console.warn("[video-affiliate-plus] load import history failed", err);
    }
  }, []);

  const scheduleCountSync = useCallback(
    (count: number) => {
      if (skipCountSyncRef.current) return;
      const id = selectedHistoryIdRef.current;
      if (!id) return;
      if (countSyncTimerRef.current) clearTimeout(countSyncTimerRef.current);
      countSyncTimerRef.current = setTimeout(() => {
        void updateImportHistoryCount(id, count)
          .then(() => refreshImportHistory())
          .catch((err) => console.warn("[video-affiliate-plus] sync history count failed", err));
      }, 500);
    },
    [refreshImportHistory]
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = loadItems().map((item) => {
        // Tránh spinner kẹt sau reload: status running cũ không còn job thật
        if (item.status === "running" || item.status === "uploading") {
          return {
            ...item,
            status: (item.videoUrls?.length ? "success" : "waiting") as ThreadStatus,
            countdown: 0,
          };
        }
        return item;
      });

      try {
        await migrateLegacyImportHistory();
        const history = await ensureImportHistoryFromItems(loaded);
        const selected = (await getSelectedImportHistoryId()) || history[0]?.id || null;
        const sessionId = selected || DEFAULT_SESSION_ID;

        let sessionItems = await getSessionItems(sessionId);
        if (!sessionItems.length && loaded.length) {
          await replaceSessionThreads(sessionId, loaded);
          sessionItems = loaded;
        }

        const hydrated = await hydrateMergedVideoUrls(sessionItems, sessionId);
        if (cancelled) return;

        setItems(hydrated);
        setImportHistory(history);
        setSelectedHistoryId(selected);
        selectedHistoryIdRef.current = selected;
        if (selected) await setSelectedImportHistoryId(selected);
      } catch (err) {
        console.warn("[video-affiliate-plus] init import history failed", err);
        if (!cancelled) {
          const hydrated = await hydrateMergedVideoUrls(loaded, DEFAULT_SESSION_ID);
          setItems(hydrated);
        }
      }
    })();
    void loadUsers()
      .then((list) => {
        if (!cancelled) setUsers(list);
      })
      .catch((err) => console.warn("[video-affiliate-plus] load users failed", err));
    void loadProxies()
      .then((list) => {
        if (!cancelled) setProxies(list);
      })
      .catch((err) => console.warn("[video-affiliate-plus] load proxies failed", err));
    setLogs(loadLogs());
    setSettings(loadSettings());
    return () => {
      cancelled = true;
      if (countSyncTimerRef.current) clearTimeout(countSyncTimerRef.current);
    };
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isGlobalRunning = items.some((i) => i.status === "running" || i.status === "uploading");

  const handleUpdateItems = useCallback(
    (next: AffiliatePlusItem[]) => {
      setItems(next);
      scheduleCountSync(next.length);
    },
    [scheduleCountSync]
  );

  const handleImportComplete = useCallback(
    async (fileName: string, nextItems: AffiliatePlusItem[]) => {
      // Revoke blob URL phiên cũ khi thay bằng phiên import mới
      itemsRef.current.forEach((item) => {
        if (item.mergedVideoUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(item.mergedVideoUrl);
          } catch {
            // ignore
          }
        }
      });

      if (countSyncTimerRef.current) {
        clearTimeout(countSyncTimerRef.current);
        countSyncTimerRef.current = null;
      }
      skipCountSyncRef.current = true;
      try {
        const entry = await pushImportHistory({
          fileName,
          itemCount: nextItems.length,
        });
        // Ghi threads TRƯỚC khi đổi selectedHistoryId — tránh effect panel seed/load phiên trống
        await replaceSessionThreads(entry.id, nextItems);
        selectedHistoryIdRef.current = entry.id;
        setSelectedHistoryId(entry.id);
        await setSelectedImportHistoryId(entry.id);
        setItems(nextItems);
        await refreshImportHistory();
      } catch (err) {
        console.warn("[video-affiliate-plus] push import history failed", err);
        setItems(nextItems);
      } finally {
        skipCountSyncRef.current = false;
      }
    },
    [refreshImportHistory]
  );

  const handleSelectHistory = useCallback(
    async (id: string) => {
      const entry = importHistory.find((h) => h.id === id);
      if (!entry) return;

      skipCountSyncRef.current = true;
      setSelectedHistoryId(id);
      selectedHistoryIdRef.current = id;
      await setSelectedImportHistoryId(id);

      // Revoke blob URLs phiên cũ trước khi thay
      itemsRef.current.forEach((item) => {
        if (item.mergedVideoUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(item.mergedVideoUrl);
          } catch {
            // ignore
          }
        }
      });

      const sessionItems = await getSessionItems(id);
      const hydrated = await hydrateMergedVideoUrls(sessionItems, id);
      setItems(hydrated);
      skipCountSyncRef.current = false;
    },
    [importHistory]
  );

  const handleClearHistory = useCallback(async () => {
    // Revoke blob URL đang giữ trên UI
    itemsRef.current.forEach((item) => {
      if (item.mergedVideoUrl?.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(item.mergedVideoUrl);
        } catch {
          // ignore
        }
      }
    });

    skipCountSyncRef.current = true;
    await clearGenerateVideoIndexedDb();
    try {
      saveItems([]);
    } catch {
      // ignore
    }
    setImportHistory([]);
    setSelectedHistoryId(null);
    selectedHistoryIdRef.current = null;
    setItems([]);
    skipCountSyncRef.current = false;
  }, []);

  const handleDeleteHistorySession = useCallback(
    async (sessionId: string) => {
      const deletingCurrent = selectedHistoryIdRef.current === sessionId;
      if (deletingCurrent) {
        itemsRef.current.forEach((item) => {
          if (item.mergedVideoUrl?.startsWith("blob:")) {
            try {
              URL.revokeObjectURL(item.mergedVideoUrl);
            } catch {
              // ignore
            }
          }
        });
      }

      skipCountSyncRef.current = true;
      try {
        const { history, nextSelectedId } = await deleteImportHistorySession(sessionId);
        setImportHistory(history);
        setSelectedHistoryId(nextSelectedId);
        selectedHistoryIdRef.current = nextSelectedId;

        if (deletingCurrent) {
          if (nextSelectedId) {
            const sessionItems = await getSessionItems(nextSelectedId);
            const hydrated = await hydrateMergedVideoUrls(sessionItems, nextSelectedId);
            setItems(hydrated);
          } else {
            setItems([]);
          }
        }
      } catch (err) {
        console.warn("[video-affiliate-plus] delete history session failed", err);
        throw err;
      } finally {
        skipCountSyncRef.current = false;
      }
    },
    []
  );

  const handleAddLog = useCallback(
    (message: string, level: AffiliatePlusLog["level"] = "info", threadId?: string) => {
      setLogs((prev) => {
        const next = appendLog(prev, message, level, threadId);
        saveLogs(next);
        return next;
      });
    },
    []
  );

  // Simulation engine
  useEffect(() => {
    const interval = setInterval(() => {
      const current = itemsRef.current;
      const hasRunning = current.some((i) => i.status === "running" || i.status === "uploading");
      if (!hasRunning) return;

      const next = simulateTick(current);
      const changed = next.some((item, i) => item !== current[i]);
      if (changed) {
        setItems(next);
        scheduleCountSync(next.length);

        next.forEach((item, i) => {
          const prev = current[i];
          if (item.status === "success" && prev.status !== "success") {
            handleAddLog(
              t("Luồng {{name}} upload thành công", { name: item.shopName }),
              "success",
              item.id
            );
          }
          if (item.status === "error" && prev.status !== "error") {
            handleAddLog(
              t("Luồng {{name}} lỗi: {{error}}", { name: item.shopName, error: item.error }),
              "error",
              item.id
            );
          }
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [handleAddLog, scheduleCountSync, t]);

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="mx-auto">
        <TabGroup
          index={activeTab}
          onChange={handleTabChange}
          name="video-affiliate-plus"
          flex={false}
          stickyHeader
          stickyHeaderClassName="sticky top-14 z-50 shadow-sm"
          beforeHeader={
            <div className="text-white bg-primary">
              <div className="px-4 mx-auto w-full" style={{ maxWidth: 1600 }}>
                <div className="flex gap-4 justify-between items-center py-1">
                  <div className="flex gap-3 items-center">
                    <div
                      onClick={() => router.back()}
                      className="flex gap-1 items-center text-sm cursor-pointer text-white/80 hover:text-white"
                    >
                      <HiArrowLeft />
                      {sm && <span>{t("Quay lại")}</span>}
                    </div>
                    <div className="w-px h-5 bg-white/30" />
                    <div className="flex gap-2 items-center">
                      <div className="flex justify-center items-center w-10 h-10 rounded-xl bg-white/20">
                        <RiVideoAddLine className="text-2xl" />
                      </div>
                      <div>
                        <h1 className="m-0 text-lg font-bold sm:text-xl">
                          {t("XƯỞNG VIDEO AFFILIATE MANAGER")}
                        </h1>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          }
          tabClassName="px-5 py-3.5"
          titleClassName="text-sm font-semibold whitespace-nowrap"
          bodyClassName="px-4 sm:px-6 py-5"
          className="px-4 sm:px-6"
        >
          <TabGroup.Tab label={t("Cào dữ liệu")}>
            <ScrapeDataPanel
              onImportItems={async (fileName, nextItems) => {
                await handleImportComplete(fileName, nextItems);
                handleTabChange(1); // Generate Video
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Generate Video")}>
            <ThreadManagementPanel
              items={items}
              settings={settings}
              isGlobalRunning={isGlobalRunning}
              importHistory={importHistory}
              selectedHistoryId={selectedHistoryId}
              onUpdateItems={handleUpdateItems}
              onImportComplete={handleImportComplete}
              onSelectHistory={handleSelectHistory}
              onDeleteHistorySession={handleDeleteHistorySession}
              onClearHistory={handleClearHistory}
              onAddLog={handleAddLog}
            />
          </TabGroup.Tab>

          <TabGroup.Tab label={t("Quản Lý Người Dùng")}>
            <UsersPanel
              users={users}
              proxies={proxies}
              onUpdateUsers={(next) => {
                setUsers(next);
                void saveUsers(next);
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Đăng video Shope")}>
            <ShopeeUploadFlowPanel
              users={users}
              proxies={proxies}
              settings={settings}
              importHistory={importHistory}
              selectedHistoryId={selectedHistoryId}
              onUpdateUsers={async (next) => {
                setUsers(next);
                await saveUsers(next);
              }}
              onUpdateSettings={(next) => {
                setSettings(next);
                void saveSettings(next);
              }}
              onAddLog={handleAddLog}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Quản lý Proxy")}>
            <ProxiesPanel
              proxies={proxies}
              onUpdateProxies={(next) => {
                setProxies(next);
                void saveProxies(next);
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Quản Lý Nhật Ký")}>
            <LogsPanel
              logs={logs}
              onClearLogs={() => {
                setLogs([]);
                saveLogs([]);
              }}
            />
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Cài Đặt")}>
            <div className="space-y-5">
              <SettingsPanel
                settings={settings}
                onUpdateSettings={(next) => {
                  setSettings(next);
                  saveSettings(next);
                }}
              />
            </div>
          </TabGroup.Tab>
        </TabGroup>
      </div>
    </div>
  );
}
