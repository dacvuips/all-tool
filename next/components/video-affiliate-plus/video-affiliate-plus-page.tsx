import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft } from "react-icons/hi";
import {
  RiFileList3Line,
  RiPlayList2Line,
  RiSettings4Line,
  RiUser3Line,
  RiVideoAddLine,
} from "react-icons/ri";
import { useScreen } from "../../lib/hooks/useScreen";
import { LogsPanel } from "./panels/logs-panel";
import { SettingsPanel } from "./panels/settings-panel";
import { ThreadManagementPanel } from "./panels/thread-management-panel";
import { UsersPanel } from "./panels/users-panel";
import {
  appendLog,
  loadItems,
  loadLogs,
  loadSettings,
  loadUsers,
  saveItems,
  saveLogs,
  saveSettings,
  saveUsers,
} from "./storage";
import {
  AffiliatePlusItem,
  AffiliatePlusLog,
  AffiliatePlusSettings,
  AffiliatePlusUser,
  ThreadStatus,
  getTotalVideos,
} from "./types";

type TabId = "users" | "threads" | "logs" | "settings";

const TABS: { id: TabId; label: string; icon: JSX.Element }[] = [
  { id: "users", label: "Quản Lý Người Dùng", icon: <RiUser3Line /> },
  { id: "threads", label: "Quản Lý Luồng", icon: <RiPlayList2Line /> },
  { id: "logs", label: "Quản Lý Nhật Ký", icon: <RiFileList3Line /> },
  { id: "settings", label: "Cài Đặt", icon: <RiSettings4Line /> },
];

function simulateTick(items: AffiliatePlusItem[]): AffiliatePlusItem[] {
  return items.map((item) => {
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

  const [activeTab, setActiveTab] = useState<TabId>("threads");
  const [items, setItems] = useState<AffiliatePlusItem[]>([]);
  const [users, setUsers] = useState<AffiliatePlusUser[]>([]);
  const [logs, setLogs] = useState<AffiliatePlusLog[]>([]);
  const [settings, setSettings] = useState<AffiliatePlusSettings>(loadSettings());
  const itemsRef = useRef(items);

  useEffect(() => {
    setItems(loadItems());
    setUsers(loadUsers());
    setLogs(loadLogs());
    setSettings(loadSettings());
  }, []);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const isGlobalRunning = items.some((i) => i.status === "running" || i.status === "uploading");

  const handleUpdateItems = useCallback((next: AffiliatePlusItem[]) => {
    setItems(next);
    saveItems(next);
  }, []);

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
        saveItems(next);

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
  }, [handleAddLog, t]);

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Top banner */}
      <div className="text-white bg-primary">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-4">
          <div className="flex gap-4 justify-between items-center">
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
                  <h1 className="m-0 text-lg font-black tracking-tight sm:text-xl">
                    VIDEO AFFILIATE PLUS MANAGER
                  </h1>
                  <p className="text-xs text-white/70 m-0 mt-0.5">
                    All Country · {new Date().toLocaleDateString("vi-VN")} · VietTheo
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="sticky top-14 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6">
          <div className="flex overflow-x-auto no-scrollbar">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-3.5 text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-red-500 text-red-600 bg-red-50/50"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                }`}
              >
                {tab.icon}
                {t(tab.label)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-5">
        {activeTab === "threads" && (
          <ThreadManagementPanel
            items={items}
            settings={settings}
            isGlobalRunning={isGlobalRunning}
            onUpdateItems={handleUpdateItems}
            onAddLog={handleAddLog}
          />
        )}
        {activeTab === "users" && (
          <UsersPanel
            users={users}
            onUpdateUsers={(next) => {
              setUsers(next);
              saveUsers(next);
            }}
          />
        )}
        {activeTab === "logs" && (
          <LogsPanel
            logs={logs}
            onClearLogs={() => {
              setLogs([]);
              saveLogs([]);
            }}
          />
        )}
        {activeTab === "settings" && (
          <SettingsPanel
            settings={settings}
            onUpdateSettings={(next) => {
              setSettings(next);
              saveSettings(next);
            }}
          />
        )}
      </div>
    </div>
  );
}
