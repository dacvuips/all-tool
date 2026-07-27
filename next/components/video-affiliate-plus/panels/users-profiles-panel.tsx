/**
 * Tab «Quản lý Profile» — danh sách + thao tác profile GPM Login (API v1).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiChevronDown,
  HiClock,
  HiDotsVertical,
  HiDownload,
  HiDuplicate,
  HiFolderOpen,
  HiOutlineClipboardCopy,
  HiOutlineColorSwatch,
  HiOutlineTerminal,
  HiOutlineX,
  HiPencil,
  HiPlay,
  HiRefresh,
  HiStop,
  HiTrash,
} from "react-icons/hi";
import { MdOutlineCookie } from "react-icons/md";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Popover } from "../../shared/utilities/popover/popover";
import {
  deleteGpmLoginProfileAction,
  downloadCsvText,
  duplicateGpmLoginProfileAction,
  fetchGpmLoginGroups,
  fetchGpmLoginProfiles,
  fetchGpmLoginStatus,
  GpmLoginGroupOption,
  GpmLoginProfileOption,
  openGpmLoginProfileFolderAction,
  probeGpmLoginRunningAction,
  refreshGpmProfileCookies,
  startGpmLoginProfileAction,
  stopGpmLoginProfileAction,
  updateGpmLoginProfileAction,
} from "../scrape/api";
import { loadUsers, saveUsers } from "../storage";
import {
  AffiliatePlusUser,
  COOKIE_TTL_MS,
  formatCookieRemaining,
  getCookieLifeColor,
  getCookieRemainingMs,
  normalizeShopeeAccountDomain,
} from "../types";
import {
  PanelListCard,
  panelListClasses,
  PanelListMatchCount,
  panelListRowClass,
  PanelListSearch,
  PanelListToolbar,
} from "../shared/panel-list-ui";

const RUNNING_STORAGE_KEY = "vap-gpm-running-profiles-v2";
/** Chỉ cập nhật cookie khi còn dưới 3 ngày (hoặc hết hạn / chưa có mốc). */
const COOKIE_REFRESH_THRESHOLD_MS = 3 * 24 * 60 * 60 * 1000;

type RunningInfo = { port?: number; since: number };

function loadRunningMap(): Record<string, RunningInfo> {
  if (typeof window === "undefined") return {};
  try {
    const raw =
      localStorage.getItem(RUNNING_STORAGE_KEY) ||
      sessionStorage.getItem("vap-gpm-running-profiles");
    return raw ? (JSON.parse(raw) as Record<string, RunningInfo>) : {};
  } catch {
    return {};
  }
}

function saveRunningMap(map: Record<string, RunningInfo>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RUNNING_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore quota
  }
}

function parseDateLoose(value?: string): Date | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const d = new Date(raw.includes("T") ? raw : raw.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatRelativeTime(value?: string): string {
  const d = parseDateLoose(value);
  if (!d) return "—";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "vừa xong";
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins}p`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months} th`;
}

function proxyLabel(rawProxy?: string): string {
  const s = String(rawProxy || "").trim();
  if (!s) return "No Proxy";
  if (/^socks5:/i.test(s)) return s.replace(/^socks5:\/\//i, "socks5://…");
  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      return u.hostname ? `${u.hostname}:${u.port || (u.protocol === "https:" ? "443" : "80")}` : s;
    } catch {
      return s.length > 28 ? `${s.slice(0, 28)}…` : s;
    }
  }
  return s.length > 28 ? `${s.slice(0, 28)}…` : s;
}

type ParsedProfileSessionInfo = {
  username?: string;
  password?: string;
  cookie?: string;
  spcF?: string;
  proxy?: string;
  cookieFetchedAt?: string;
};

function parseProfileSavedInfo(note?: string): ParsedProfileSessionInfo {
  const text = String(note || "").trim();
  if (!text) return {};
  const read = (label: string) => {
    const match = text.match(new RegExp(`(?:^|\\n)${label}:\\s*(.+)`, "i"));
    const value = String(match?.[1] || "").trim();
    if (!value || value === "—" || value === "No Proxy") return "";
    return value;
  };
  // Cookie full nằm ở dòng `Cookie:` — không lấy nhầm `Cookie cập nhật:`
  const cookieMatch = text.match(/(?:^|\n)Cookie:\s*(.+)/i);
  let cookie = String(cookieMatch?.[1] || "").trim();
  if (!cookie || cookie === "—") cookie = "";
  // Note cũ có thể bị cắt `…` — bỏ dấu cắt để tránh xuất cookie lỗi
  if (cookie.endsWith("…") || cookie.endsWith("...")) {
    cookie = "";
  }
  return {
    username: read("Username") || undefined,
    password: read("Mật khẩu") || undefined,
    cookie: cookie || undefined,
    spcF: read("SPC_F") || undefined,
    proxy: read("Proxy") || undefined,
    cookieFetchedAt: read("Cookie cập nhật") || undefined,
  };
}

type ProfileSavedInfo = ParsedProfileSessionInfo & {
  source: "account" | "note" | "none";
  cookieRemainingMs: number;
};

function getProfileSavedInfo(
  profile: GpmLoginProfileOption,
  user?: AffiliatePlusUser
): ProfileSavedInfo {
  const parsed = parseProfileSavedInfo(profile.note);
  const accountCookie = String(user?.cookieApp || user?.cookie || "").trim();
  const accountSpcF = String(user?.spcF || "").trim();
  const accountProxy = String(user?.proxy || "").trim();
  const accountFetchedAt = String(user?.cookieFetchedAt || "").trim();
  const accountUsername = String(user?.username || "").trim();
  const accountPassword = String(user?.password || "").trim();
  const fromAccount =
    Boolean(accountUsername) ||
    Boolean(accountPassword) ||
    Boolean(accountCookie) ||
    Boolean(accountSpcF) ||
    Boolean(accountProxy) ||
    Boolean(accountFetchedAt);
  const cookieFetchedAt = accountFetchedAt || parsed.cookieFetchedAt || "";
  const cookieRemainingMs = accountFetchedAt
    ? getCookieRemainingMs(user)
    : cookieFetchedAt
    ? Math.max(0, new Date(cookieFetchedAt).getTime() + COOKIE_TTL_MS - Date.now())
    : 0;
  return {
    username: accountUsername || parsed.username,
    password: accountPassword || parsed.password,
    cookie: accountCookie || parsed.cookie,
    spcF: accountSpcF || parsed.spcF,
    proxy: accountProxy || parsed.proxy || profile.rawProxy,
    cookieFetchedAt: cookieFetchedAt || undefined,
    source: fromAccount ? "account" : profile.note ? "note" : "none",
    cookieRemainingMs: Number.isFinite(cookieRemainingMs) ? cookieRemainingMs : 0,
  };
}

function maskSecret(value?: string, keep = 4): string {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  if (raw.length <= keep * 2) return raw;
  return `${raw.slice(0, keep)}…${raw.slice(-keep)}`;
}

function resolveProfileDomain(
  profile: GpmLoginProfileOption,
  user?: AffiliatePlusUser
): string {
  if (user?.domain) return normalizeShopeeAccountDomain(user.domain);
  const fromName = String(profile.name || "").match(/·\s*(shopee\.[a-z0-9.]+)/i);
  if (fromName?.[1]) return normalizeShopeeAccountDomain(fromName[1]);
  const fromNote = String(profile.note || "").match(/shopee\.[a-z0-9.]+/i);
  if (fromNote?.[0]) return normalizeShopeeAccountDomain(fromNote[0]);
  return "vn";
}

function needsCookieRefresh(info: ProfileSavedInfo): boolean {
  if (!info.cookieFetchedAt) return true;
  return info.cookieRemainingMs < COOKIE_REFRESH_THRESHOLD_MS;
}

function csvEscape(value: string): string {
  const s = String(value || "");
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function ProfileBrowserBadge({
  browserName,
  browserVersion,
  os,
}: {
  browserName?: string;
  browserVersion?: string;
  os?: string;
}) {
  const versionShort = browserVersion?.split(".")[0] || "—";
  const osLabel = os === "windows" ? "Win" : os === "macos" ? "Mac" : os || "";
  return (
    <div className="relative shrink-0 w-9 h-9">
      <div className="flex justify-center items-center w-9 h-9 text-lg bg-white rounded-lg border border-gray-200 shadow-sm">
        🌐
      </div>
      {osLabel ? (
        <span className="absolute -bottom-1 -left-1 px-1 text-[9px] font-bold leading-none text-white bg-slate-600 rounded">
          {osLabel}
        </span>
      ) : null}
      <span className="absolute -right-1 -bottom-1 px-1 min-w-[18px] text-[9px] font-bold leading-none text-center text-white bg-emerald-600 rounded">
        {versionShort}
      </span>
      {browserName ? <span className="sr-only">{browserName}</span> : null}
    </div>
  );
}

type ActionMenuProps = {
  onAction: (action: string) => void;
};

type BulkDropdownItem = {
  id: string;
  label: string;
  disabled?: boolean;
  danger?: boolean;
};

function ProfileBulkDropdown({
  label,
  items,
  onSelect,
  disabled,
}: {
  label: string;
  items: BulkDropdownItem[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex gap-1 items-center px-3 h-8 text-sm font-medium text-gray-800 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
      >
        <span>{label}</span>
        <HiChevronDown className="text-sm text-gray-500 shrink-0" />
      </button>
      <Popover
        reference={btnRef}
        trigger="click"
        placement="bottom-start"
        arrow={false}
        maxWidth={260}
        visible={open}
        hideOnClickOutside
        zIndex={10050}
        onHidden={() => setOpen(false)}
        onClickOutside={() => setOpen(false)}
      >
        <div className="py-1 min-w-[200px]">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={item.disabled}
              className={`flex gap-2 items-center px-3 py-2 w-full text-sm text-left hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed ${
                item.danger ? "text-rose-600" : "text-gray-700"
              }`}
              onClick={() => {
                if (item.disabled) return;
                setOpen(false);
                onSelect(item.id);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Popover>
    </>
  );
}

type ProfileBulkToolbarProps = {
  count: number;
  bulkBusy: boolean;
  canEditOne: boolean;
  canRemotePort: boolean;
  onClear: () => void;
  onStart: () => void;
  onStop: () => void;
  onExport: (format: "csv" | "json") => void;
  onEditAction: (action: string) => void;
  onCopyAction: (action: string) => void;
  onDelete: () => void;
  onToolsAction: (action: string) => void;
};

function ProfileBulkToolbar({
  count,
  bulkBusy,
  canEditOne,
  canRemotePort,
  onClear,
  onStart,
  onStop,
  onExport,
  onEditAction,
  onCopyAction,
  onDelete,
  onToolsAction,
}: ProfileBulkToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap gap-2 items-center px-4 py-2.5 bg-white border-b border-gray-200">
      <button
        type="button"
        onClick={onClear}
        disabled={bulkBusy}
        className="inline-flex justify-center items-center w-7 h-7 text-gray-500 rounded-md hover:bg-gray-100 disabled:opacity-50"
        title={t("Bỏ chọn") as string}
      >
        <HiOutlineX className="text-lg" />
      </button>
      <span className="text-sm font-medium text-gray-800 whitespace-nowrap">
        {t("{{count}} profile đang chọn", { count })}
      </span>
      <div className="hidden w-px h-6 bg-gray-200 sm:block" aria-hidden />
      <button
        type="button"
        onClick={onStart}
        disabled={bulkBusy}
        className="inline-flex gap-1 items-center px-3 h-8 text-sm font-semibold text-emerald-600 bg-white rounded-lg border border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
      >
        <HiPlay className="text-base" />
        {t("Mở")}
      </button>
      <button
        type="button"
        onClick={onStop}
        disabled={bulkBusy}
        className="inline-flex gap-1 items-center px-3 h-8 text-sm font-semibold text-rose-600 bg-white rounded-lg border border-rose-500 hover:bg-rose-50 disabled:opacity-50"
      >
        <HiStop className="text-base" />
        {t("Đóng")}
      </button>
      <ProfileBulkDropdown
        label={t("Export") as string}
        disabled={bulkBusy}
        items={[
          { id: "csv", label: t("Export CSV") as string },
          { id: "json", label: t("Export JSON") as string },
        ]}
        onSelect={(id) => onExport(id as "csv" | "json")}
      />
      <ProfileBulkDropdown
        label={t("Sửa") as string}
        disabled={bulkBusy}
        items={[
          {
            id: "edit-one",
            label: t("Sửa profile") as string,
            disabled: !canEditOne,
          },
          { id: "move-group", label: t("Đổi nhóm") as string },
        ]}
        onSelect={onEditAction}
      />
      <ProfileBulkDropdown
        label={t("Sao chép") as string}
        disabled={bulkBusy}
        items={[
          { id: "duplicate", label: t("Nhân bản profile") as string },
          { id: "copy-ids", label: t("Copy ID") as string },
        ]}
        onSelect={onCopyAction}
      />
      <button
        type="button"
        onClick={onDelete}
        disabled={bulkBusy}
        className="inline-flex gap-1 items-center px-3 h-8 text-sm font-semibold text-rose-600 bg-white rounded-lg border border-rose-500 hover:bg-rose-50 disabled:opacity-50"
      >
        <HiTrash className="text-base" />
        {t("Xóa")}
      </button>
      <ProfileBulkDropdown
        label={t("Công cụ") as string}
        disabled={bulkBusy}
        items={[
          { id: "open-folder", label: t("Mở thư mục profile") as string },
          {
            id: "remote-port",
            label: t("Chạy với remote port") as string,
            disabled: !canRemotePort,
          },
        ]}
        onSelect={onToolsAction}
      />
    </div>
  );
}

function ProfileActionMenu({ onAction }: ActionMenuProps) {
  const { t } = useTranslation();
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  const items = [
    { id: "edit", label: t("Sửa"), icon: <HiPencil className="text-base text-gray-600" /> },
    {
      id: "view-saved-info",
      label: t("Xem thông tin đã lưu"),
      icon: <HiClock className="text-base text-emerald-600" />,
    },
    {
      id: "duplicate",
      label: t("Nhân bản"),
      icon: <HiDuplicate className="text-base text-gray-600" />,
    },
    {
      id: "color",
      label: t("Thay đổi màu sắc"),
      icon: <HiOutlineColorSwatch className="text-base text-gray-600" />,
    },
    {
      id: "import-cookie",
      label: t("Import cookie"),
      icon: <MdOutlineCookie className="text-base text-amber-600" />,
    },
    {
      id: "open-folder",
      label: t("Mở thư mục profile"),
      icon: <HiFolderOpen className="text-base text-sky-600" />,
    },
    {
      id: "remote-port",
      label: t("Chạy với remote port"),
      icon: <HiOutlineTerminal className="text-base text-indigo-600" />,
    },
    {
      id: "copy-id",
      label: t("Copy ID"),
      icon: <HiOutlineClipboardCopy className="text-base text-gray-600" />,
    },
  ];

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex justify-center items-center w-8 h-8 text-gray-500 rounded-lg border border-gray-200 hover:bg-gray-50"
        title={t("Thao tác") as string}
      >
        <HiDotsVertical />
      </button>
      <Popover
        reference={btnRef}
        trigger="click"
        placement="bottom-end"
        arrow={false}
        maxWidth={280}
        visible={open}
        hideOnClickOutside
        zIndex={10050}
        onHidden={() => setOpen(false)}
        onClickOutside={() => setOpen(false)}
      >
        <div className="py-1 min-w-[220px]">
          {items.map((item, idx) => (
            <div key={item.id}>
              {idx === 5 ? <div className="my-1 border-t border-gray-100" /> : null}
              {idx === 6 ? <div className="my-1 border-t border-gray-100" /> : null}
              <button
                type="button"
                className="flex gap-2 items-center px-3 py-2 w-full text-sm text-left text-gray-700 hover:bg-gray-50"
                onClick={() => {
                  setOpen(false);
                  onAction(item.id);
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            </div>
          ))}
          <div className="my-1 border-t border-gray-100" />
          <button
            type="button"
            className="flex gap-2 items-center px-3 py-2 w-full text-sm text-left text-rose-600 hover:bg-rose-50"
            onClick={() => {
              setOpen(false);
              onAction("delete");
            }}
          >
            <HiStop className="text-base" />
            <span>{t("Xóa profile")}</span>
          </button>
        </div>
      </Popover>
    </>
  );
}

export function UsersProfilesPanel() {
  const { t } = useTranslation();
  const toast = useToast();

  const [groups, setGroups] = useState<GpmLoginGroupOption[]>([]);
  const [profiles, setProfiles] = useState<GpmLoginProfileOption[]>([]);
  const [groupId, setGroupId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [gpmOnline, setGpmOnline] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AffiliatePlusUser[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [runningMap, setRunningMap] = useState<Record<string, RunningInfo>>({});
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const runningMapRef = useRef<Record<string, RunningInfo>>({});

  const [editProfile, setEditProfile] = useState<GpmLoginProfileOption | null>(null);
  const [editName, setEditName] = useState("");
  const [editProxy, setEditProxy] = useState("");
  const [editNote, setEditNote] = useState("");
  const [editGroupId, setEditGroupId] = useState("");

  const [remotePortProfile, setRemotePortProfile] = useState<GpmLoginProfileOption | null>(null);
  const [remotePortValue, setRemotePortValue] = useState("9222");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkMoveGroupOpen, setBulkMoveGroupOpen] = useState(false);
  const [bulkMoveGroupId, setBulkMoveGroupId] = useState("");
  const [viewProfile, setViewProfile] = useState<GpmLoginProfileOption | null>(null);
  const [cookieRefreshBusy, setCookieRefreshBusy] = useState(false);
  const [cookieRefreshProgress, setCookieRefreshProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);

  useEffect(() => {
    const loaded = loadRunningMap();
    runningMapRef.current = loaded;
    setRunningMap(loaded);
  }, []);

  useEffect(() => {
    let mounted = true;
    void loadUsers()
      .then((list) => {
        if (mounted) setUsers(list);
      })
      .catch(() => {
        if (mounted) setUsers([]);
      });
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    runningMapRef.current = runningMap;
    saveRunningMap(runningMap);
  }, [runningMap]);

  const syncRunningFromProbe = useCallback(async () => {
    const current = runningMapRef.current;
    const items = Object.entries(current)
      .filter(([, info]) => Number(info.port) > 0)
      .map(([profileId, info]) => ({ profileId, port: info.port }));
    if (!items.length) return;

    try {
      const statuses = await probeGpmLoginRunningAction(items);
      setRunningMap((prev) => {
        const next = { ...prev };
        let changed = false;
        for (const st of statuses) {
          const existing = next[st.profileId];
          if (!existing) continue;
          const recentlyStarted = Date.now() - existing.since < 20000;
          if (st.running) {
            if (st.port && st.port !== existing.port) {
              next[st.profileId] = { ...existing, port: st.port };
              changed = true;
            }
          } else if (!recentlyStarted) {
            delete next[st.profileId];
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    } catch {
      // agent offline — giữ trạng thái local
    }
  }, []);

  useEffect(() => {
    void syncRunningFromProbe();
    const timer = setInterval(() => {
      void syncRunningFromProbe();
    }, 4000);
    return () => clearInterval(timer);
  }, [syncRunningFromProbe]);

  const loadAll = useCallback(
    async (selectedGroupId: string) => {
      setLoading(true);
      try {
        const localUsers = await loadUsers().catch(() => []);
        setUsers(localUsers);
        const st = await fetchGpmLoginStatus();
        setGpmOnline(Boolean(st.online));
        if (!st.agentOnline) {
          throw new Error(
            st.message || (t("Chưa thấy Local Agent — mở Shopee Scrape Agent") as string)
          );
        }
        if (!st.online) {
          throw new Error(t("GPM Login chưa online (localhost:9495)") as string);
        }
        const groupList = await fetchGpmLoginGroups();
        setGroups(groupList);

        let effectiveGroup = selectedGroupId;
        if (effectiveGroup && !groupList.some((g) => g.id === effectiveGroup)) {
          effectiveGroup = "";
          setGroupId("");
        }

        const profileList = await fetchGpmLoginProfiles({
          groupId: effectiveGroup || undefined,
        });
        setProfiles(profileList);
      } catch (err: any) {
        setProfiles([]);
        toast.error(String(err?.message || err || "Không tải được profile GPM"));
      } finally {
        setLoading(false);
      }
    },
    [t, toast]
  );

  useEffect(() => {
    void loadAll(groupId);
  }, [groupId, loadAll]);

  const groupNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of groups) map.set(g.id, g.name);
    return map;
  }, [groups]);

  const userByProfileId = useMemo(() => {
    const map = new Map<string, AffiliatePlusUser>();
    for (const user of users) {
      const profileId = String(user.gpmProfileId || "").trim();
      if (profileId) map.set(profileId, user);
    }
    return map;
  }, [users]);

  const normalizedTerm = searchTerm.toLowerCase();
  const filteredProfiles = useMemo(() => {
    if (!normalizedTerm) return profiles;
    return profiles.filter((p) => {
      const groupName = p.groupId ? groupNameById.get(p.groupId) || p.groupId : "";
      const info = getProfileSavedInfo(p, userByProfileId.get(p.id));
      return [
        p.name,
        p.id,
        p.groupId,
        groupName,
        p.rawProxy,
        p.note,
        info.username,
        info.password,
        info.cookie,
        info.spcF,
        info.proxy,
        ...(p.tags || []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedTerm);
    });
  }, [profiles, normalizedTerm, groupNameById, userByProfileId]);

  const allVisibleSelected =
    filteredProfiles.length > 0 && filteredProfiles.every((p) => selectedIds.has(p.id));

  const selectedProfiles = useMemo(
    () => filteredProfiles.filter((p) => selectedIds.has(p.id)),
    [filteredProfiles, selectedIds]
  );

  const selectedCount = selectedProfiles.length;

  const runningCount = useMemo(
    () => filteredProfiles.filter((p) => Boolean(runningMap[p.id])).length,
    [filteredProfiles, runningMap]
  );

  const setBusy = (id: string, busy: boolean) => {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const markRunning = (id: string, port?: number) => {
    setRunningMap((prev) => {
      const next = {
        ...prev,
        [id]: { port: port && port > 0 ? port : prev[id]?.port, since: Date.now() },
      };
      runningMapRef.current = next;
      saveRunningMap(next);
      return next;
    });
  };

  const markStopped = (id: string) => {
    setRunningMap((prev) => {
      const next = { ...prev };
      delete next[id];
      runningMapRef.current = next;
      saveRunningMap(next);
      return next;
    });
  };

  const handleStart = async (profile: GpmLoginProfileOption, remoteDebuggingPort?: number) => {
    setBusy(profile.id, true);
    // Optimistic: hiện «Đang mở» ngay khi bấm
    markRunning(profile.id, remoteDebuggingPort);
    try {
      const result = await startGpmLoginProfileAction({
        profileId: profile.id,
        remoteDebuggingPort,
      });
      markRunning(profile.id, result.port || remoteDebuggingPort || undefined);
      toast.success(
        remoteDebuggingPort
          ? `${t("Đã mở profile")} — CDP :${result.port || remoteDebuggingPort}`
          : (t("Đã mở profile") as string)
      );
    } catch (err: any) {
      markStopped(profile.id);
      toast.error(String(err?.message || err));
    } finally {
      setBusy(profile.id, false);
    }
  };

  const handleStop = async (profile: GpmLoginProfileOption) => {
    setBusy(profile.id, true);
    const prev = runningMapRef.current[profile.id];
    // Optimistic: hiện «Đã đóng» ngay khi bấm
    markStopped(profile.id);
    try {
      await stopGpmLoginProfileAction(profile.id);
      toast.success(t("Đã đóng profile") as string);
    } catch (err: any) {
      if (prev) {
        setRunningMap((map) => {
          const next = { ...map, [profile.id]: prev };
          runningMapRef.current = next;
          saveRunningMap(next);
          return next;
        });
      }
      toast.error(String(err?.message || err));
    } finally {
      setBusy(profile.id, false);
    }
  };

  const openEditDialog = (profile: GpmLoginProfileOption) => {
    setEditProfile(profile);
    setEditName(profile.name);
    setEditProxy(profile.rawProxy || "");
    setEditNote(profile.note || "");
    setEditGroupId(profile.groupId || "");
  };

  const handleSaveEdit = async () => {
    if (!editProfile) return;
    setBusy(editProfile.id, true);
    try {
      await updateGpmLoginProfileAction({
        profileId: editProfile.id,
        name: editName.trim(),
        rawProxy: editProxy,
        note: editNote,
        groupId: editGroupId || undefined,
      });
      toast.success(t("Đã cập nhật profile") as string);
      setEditProfile(null);
      void loadAll(groupId);
    } catch (err: any) {
      toast.error(String(err?.message || err));
    } finally {
      setBusy(editProfile.id, false);
    }
  };

  const handleProfileAction = async (profile: GpmLoginProfileOption, action: string) => {
    if (action === "view-saved-info") {
      setViewProfile(profile);
      return;
    }
    if (action === "edit") {
      openEditDialog(profile);
      return;
    }
    if (action === "duplicate") {
      setBusy(profile.id, true);
      try {
        const dup = await duplicateGpmLoginProfileAction({ profileId: profile.id });
        toast.success(`${t("Đã nhân bản")}: ${dup.name}`);
        void loadAll(groupId);
      } catch (err: any) {
        toast.error(String(err?.message || err));
      } finally {
        setBusy(profile.id, false);
      }
      return;
    }
    if (action === "color") {
      toast.info(
        t("Đổi màu profile: dùng GPM Login app hoặc API update (color) khi có hỗ trợ v1") as string
      );
      return;
    }
    if (action === "import-cookie") {
      toast.info(
        t(
          "Import cookie: mở profile → dùng tab Quản lý tài khoản «Tạo Profile» hoặc GPM Login app"
        ) as string
      );
      return;
    }
    if (action === "open-folder") {
      setBusy(profile.id, true);
      try {
        const folder = await openGpmLoginProfileFolderAction(profile.id);
        toast.success(`${t("Đã mở thư mục")}: ${folder}`);
      } catch (err: any) {
        toast.error(String(err?.message || err));
      } finally {
        setBusy(profile.id, false);
      }
      return;
    }
    if (action === "remote-port") {
      setRemotePortProfile(profile);
      setRemotePortValue(String(runningMap[profile.id]?.port || 9222));
      return;
    }
    if (action === "copy-id") {
      try {
        await navigator.clipboard.writeText(profile.id);
        toast.success(t("Đã copy ID profile") as string);
      } catch {
        toast.error(t("Không copy được ID") as string);
      }
      return;
    }
    if (action === "delete") {
      if (!window.confirm(`${t("Xóa profile")} «${profile.name}»?`)) return;
      setBusy(profile.id, true);
      try {
        await deleteGpmLoginProfileAction(profile.id, "soft");
        markStopped(profile.id);
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(profile.id);
          return next;
        });
        toast.success(t("Đã xóa profile") as string);
        void loadAll(groupId);
      } catch (err: any) {
        toast.error(String(err?.message || err));
      } finally {
        setBusy(profile.id, false);
      }
    }
  };

  const toggleSelectVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const p of filteredProfiles) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  };

  const toggleSelectOne = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const runBulkSequential = async (
    targets: GpmLoginProfileOption[],
    fn: (profile: GpmLoginProfileOption) => Promise<void>,
    delayMs = 600
  ) => {
    if (!targets.length) return;
    setBulkBusy(true);
    try {
      for (let i = 0; i < targets.length; i++) {
        await fn(targets[i]);
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkStart = async () => {
    const targets = selectedProfiles.filter((p) => !runningMap[p.id]);
    if (!targets.length) {
      toast.info(t("Các profile đã chọn đều đang mở") as string);
      return;
    }
    await runBulkSequential(targets, (p) => handleStart(p));
  };

  const handleBulkStop = async () => {
    const targets = selectedProfiles.filter((p) => runningMap[p.id]);
    if (!targets.length) {
      toast.info(t("Không có profile đang mở trong danh sách đã chọn") as string);
      return;
    }
    await runBulkSequential(targets, (p) => handleStop(p), 400);
  };

  const handleBulkExport = (format: "csv" | "json") => {
    if (!selectedProfiles.length) return;
    const stamp = new Date().toISOString().slice(0, 10);
    if (format === "json") {
      const payload = selectedProfiles.map((p) => {
        const info = getProfileSavedInfo(p, userByProfileId.get(p.id));
        return {
          id: p.id,
          name: p.name,
          groupId: p.groupId || "",
          groupName: p.groupId ? groupNameById.get(p.groupId) || p.groupId : "",
          rawProxy: p.rawProxy || "",
          note: p.note || "",
          tags: p.tags || [],
          status: runningMap[p.id] ? "running" : "stopped",
          createdAt: p.createdAt || "",
          updatedAt: p.updatedAt || "",
          username: info.username || "",
          password: info.password || "",
          cookie: info.cookie || "",
          spcF: info.spcF || "",
          proxy: info.proxy || "",
          cookieFetchedAt: info.cookieFetchedAt || "",
          cookieRemaining: formatCookieRemaining(info.cookieRemainingMs),
        };
      });
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gpm-profiles-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(t("Đã export JSON") as string);
      return;
    }

    const esc = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const header = [
      "id",
      "name",
      "group",
      "proxy",
      "username",
      "password",
      "cookie",
      "spc_f",
      "cookieFetchedAt",
      "cookieRemaining",
      "note",
      "tags",
      "status",
      "updatedAt",
    ];
    const rows = selectedProfiles.map((p) => {
      const groupName = p.groupId ? groupNameById.get(p.groupId) || p.groupId : "";
      const status = runningMap[p.id] ? "running" : "stopped";
      const info = getProfileSavedInfo(p, userByProfileId.get(p.id));
      return [
        esc(p.id),
        esc(p.name),
        esc(groupName),
        esc(info.proxy || p.rawProxy || ""),
        esc(info.username || ""),
        esc(info.password || ""),
        esc(info.cookie || ""),
        esc(info.spcF || ""),
        esc(info.cookieFetchedAt || ""),
        esc(formatCookieRemaining(info.cookieRemainingMs)),
        esc(p.note || ""),
        esc((p.tags || []).join("; ")),
        esc(status),
        esc(p.updatedAt || p.createdAt || ""),
      ].join(",");
    });
    downloadCsvText([header.join(","), ...rows].join("\n"), `gpm-profiles-${stamp}.csv`);
    toast.success(t("Đã export CSV") as string);
  };

  const handleBulkDuplicate = async () => {
    if (!selectedProfiles.length) return;
    await runBulkSequential(selectedProfiles, async (p) => {
      await duplicateGpmLoginProfileAction({ profileId: p.id });
    });
    toast.success(`${t("Đã nhân bản")} ${selectedProfiles.length} profile`);
    void loadAll(groupId);
  };

  const handleBulkDelete = async () => {
    if (!selectedProfiles.length) return;
    if (
      !window.confirm(
        `${t("Xóa")} ${selectedProfiles.length} ${t("profile đã chọn")}?`
      )
    ) {
      return;
    }
    await runBulkSequential(selectedProfiles, async (p) => {
      await deleteGpmLoginProfileAction(p.id, "soft");
      markStopped(p.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(p.id);
        return next;
      });
    });
    toast.success(t("Đã xóa profile") as string);
    void loadAll(groupId);
  };

  const handleBulkCopyIds = async () => {
    if (!selectedProfiles.length) return;
    try {
      await navigator.clipboard.writeText(selectedProfiles.map((p) => p.id).join("\n"));
      toast.success(t("Đã copy ID profile") as string);
    } catch {
      toast.error(t("Không copy được ID") as string);
    }
  };

  const handleBulkOpenFolders = async () => {
    if (!selectedProfiles.length) return;
    await runBulkSequential(selectedProfiles, async (p) => {
      const folder = await openGpmLoginProfileFolderAction(p.id);
      toast.success(`${t("Đã mở thư mục")}: ${folder}`, { autoClose: 2500 });
    }, 300);
  };

  const handleBulkEditAction = (action: string) => {
    if (action === "edit-one") {
      if (selectedProfiles.length === 1) openEditDialog(selectedProfiles[0]);
      return;
    }
    if (action === "move-group") {
      setBulkMoveGroupId(selectedProfiles[0]?.groupId || groupId || groups[0]?.id || "");
      setBulkMoveGroupOpen(true);
    }
  };

  const handleBulkCopyAction = (action: string) => {
    if (action === "duplicate") void handleBulkDuplicate();
    if (action === "copy-ids") void handleBulkCopyIds();
  };

  const handleBulkToolsAction = (action: string) => {
    if (action === "open-folder") void handleBulkOpenFolders();
    if (action === "remote-port" && selectedProfiles.length === 1) {
      setRemotePortProfile(selectedProfiles[0]);
      setRemotePortValue(String(runningMap[selectedProfiles[0].id]?.port || 9222));
    }
  };

  const handleBulkMoveGroupSave = async () => {
    if (!selectedProfiles.length) return;
    setBulkBusy(true);
    try {
      for (const p of selectedProfiles) {
        await updateGpmLoginProfileAction({
          profileId: p.id,
          groupId: bulkMoveGroupId || undefined,
        });
      }
      toast.success(t("Đã đổi nhóm profile") as string);
      setBulkMoveGroupOpen(false);
      void loadAll(groupId);
    } catch (err: any) {
      toast.error(String(err?.message || err));
    } finally {
      setBulkBusy(false);
    }
  };

  const handleExportAccountList = () => {
    if (!selectedProfiles.length) {
      toast.warn(t("Hãy chọn (checked) ít nhất 1 profile trước khi xuất") as string);
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    let missingCookie = 0;
    const rows = selectedProfiles.map((p) => {
      const info = getProfileSavedInfo(p, userByProfileId.get(p.id));
      const username = String(info.username || "").trim();
      const cookie = String(info.cookie || "").trim();
      const proxy = String(info.proxy || p.rawProxy || "").trim();
      if (!cookie) missingCookie += 1;
      const col4 = username && cookie ? `${username}|${cookie}` : "";
      const col5 = username && proxy ? `${username}|${proxy}` : "";
      return [csvEscape(username), csvEscape(cookie), csvEscape(proxy), csvEscape(col4), csvEscape(col5)].join(
        ","
      );
    });
    // Hàng 1 = tiêu đề
    const header = ["User", "cookie", "Proxy", "User + cookies", "User + proxy"].join(",");
    downloadCsvText([header, ...rows].join("\n"), `gpm-accounts-${stamp}.csv`);
    if (missingCookie > 0) {
      toast.warn(
        `${t("Đã xuất") as string} ${selectedProfiles.length} · ${missingCookie} ${t(
          "dòng thiếu cookie (profile chưa có thông tin đã lưu đầy đủ)"
        ) as string}`
      );
    } else {
      toast.success(
        `${t("Đã xuất danh sách tài khoản") as string}: ${selectedProfiles.length}`
      );
    }
  };

  const applySavedSessionToUsers = async (
    profileId: string,
    session: NonNullable<Awaited<ReturnType<typeof refreshGpmProfileCookies>>["savedSession"]>
  ) => {
    let nextUsers: AffiliatePlusUser[] = [];
    setUsers((prev) => {
      nextUsers = prev.map((u) => {
        if (String(u.gpmProfileId || "").trim() !== profileId) return u;
        return {
          ...u,
          username: session.username || u.username,
          password: session.password || u.password,
          cookie: session.cookie || u.cookie,
          cookieApp: session.cookie || u.cookieApp,
          spcF: session.spcF || u.spcF,
          proxy: session.proxy || u.proxy,
          cookieFetchedAt: session.cookieFetchedAt || u.cookieFetchedAt,
        };
      });
      return nextUsers;
    });
    if (nextUsers.length) await saveUsers(nextUsers);
  };

  const handleRefreshCookiesBatch = async () => {
    if (cookieRefreshBusy || bulkBusy) return;
    const pool = selectedCount > 0 ? selectedProfiles : filteredProfiles;
    const targets = pool.filter((p) =>
      needsCookieRefresh(getProfileSavedInfo(p, userByProfileId.get(p.id)))
    );
    if (!targets.length) {
      toast.info(
        t(
          "Không có profile nào cần cập nhật (chỉ cập nhật khi còn dưới 3 ngày hoặc chưa có mốc cookie)"
        ) as string
      );
      return;
    }
    if (
      !window.confirm(
        `${t("Cập nhật cookies")} ${targets.length} ${t("profile")}?\n${t(
          "Chỉ xử lý profile còn dưới 3 ngày. Còn login → đồng bộ cookie + reset 6 ngày (không re-login). Hết session → login lại. Có captcha thì giải trên cửa sổ GPM."
        )}`
      )
    ) {
      return;
    }

    setCookieRefreshBusy(true);
    setCookieRefreshProgress({ done: 0, total: targets.length });
    let updated = 0;
    let skipped = 0;
    let failed = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        const profile = targets[i];
        setCookieRefreshProgress({ done: i, total: targets.length });
        const user = userByProfileId.get(profile.id);
        const info = getProfileSavedInfo(profile, user);
        try {
          markRunning(profile.id);
          const result = await refreshGpmProfileCookies({
            profileId: profile.id,
            domain: resolveProfileDomain(profile, user),
            username: info.username || undefined,
            password: info.password || undefined,
            cookie: info.cookie || undefined,
            spcF: info.spcF || undefined,
            proxy: info.proxy || profile.rawProxy || undefined,
          });
          if (result.profileStopped) markStopped(profile.id);
          if (result.cookieUpdated && result.savedSession) {
            updated += 1;
            await applySavedSessionToUsers(profile.id, result.savedSession);
          } else if (result.skipped && result.skipReason === "no_credentials") {
            skipped += 1;
            if (result.profileStopped) markStopped(profile.id);
          } else {
            failed += 1;
            if (result.profileStopped) markStopped(profile.id);
          }
        } catch (err: any) {
          const msg = String(err?.message || err || "");
          const keepOpenForCaptcha = /captcha/i.test(msg);
          if (!keepOpenForCaptcha) markStopped(profile.id);
          failed += 1;
          toast.error(`${profile.name}: ${msg}`, { autoClose: 4500 });
        }
        setCookieRefreshProgress({ done: i + 1, total: targets.length });
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }
      await loadAll(groupId);
      toast.success(
        `${t("Cập nhật cookies xong") as string}: ${t("cập nhật")} ${updated} · ${t(
          "bỏ qua"
        )} ${skipped} · ${t("lỗi")} ${failed}`
      );
    } finally {
      setCookieRefreshBusy(false);
      setCookieRefreshProgress(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: t("Nhóm"),
            value: groups.length,
            bg: "#e0f2fe",
            border: "#38bdf8",
            text: "#0284c7",
            dot: "#0ea5e9",
          },
          {
            label: t("Profile"),
            value: profiles.length,
            bg: "#ecfdf5",
            border: "#34d399",
            text: "#059669",
            dot: "#10b981",
          },
          {
            label: t("Đang mở"),
            value: runningCount,
            bg: "#f0fdf4",
            border: "#86efac",
            text: "#15803d",
            dot: "#22c55e",
          },
          {
            label: t("GPM"),
            value:
              gpmOnline == null
                ? "…"
                : gpmOnline
                ? (t("Online") as string)
                : (t("Offline") as string),
            bg: gpmOnline ? "#ecfdf5" : "#fff1f2",
            border: gpmOnline ? "#34d399" : "#fb7185",
            text: gpmOnline ? "#059669" : "#e11d48",
            dot: gpmOnline ? "#10b981" : "#f43f5e",
          },
        ].map((s) => (
          <div
            key={String(s.label)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg border shadow-sm"
            style={{ backgroundColor: s.bg, borderColor: s.border, color: s.text }}
          >
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.dot }} />
            <span className="text-xs font-medium">{s.label}</span>
            <span className="text-sm font-bold">{s.value}</span>
          </div>
        ))}
      </div>

      <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col gap-3 justify-between lg:flex-row lg:items-center">
          <div className="flex flex-wrap gap-2 items-center">
            <label className="text-sm font-medium text-gray-700">{t("Nhóm profile")}</label>
            <select
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              disabled={loading}
              className="h-9 min-w-[220px] rounded-lg border border-gray-300 px-2 text-sm outline-none focus:border-emerald-500 disabled:opacity-60"
            >
              <option value="">{t("Tất cả nhóm")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadAll(groupId)}
              disabled={loading || cookieRefreshBusy}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-white rounded-lg shadow-sm disabled:opacity-50"
              style={{ backgroundColor: "#047857" }}
              title={t("Tải lại từ GPM Login") as string}
            >
              <HiRefresh className={`text-base ${loading ? "animate-spin" : ""}`} />
              {loading ? (t("Đang tải…") as string) : (t("Tải lại GPM") as string)}
            </button>
            <button
              type="button"
              onClick={handleExportAccountList}
              disabled={loading || cookieRefreshBusy || selectedCount === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-sky-700 bg-white rounded-lg border border-sky-300 hover:bg-sky-50 disabled:opacity-50"
              title={
                t(
                  "Chọn profile rồi xuất CSV: Username, Cookie, Proxy, Username|Cookie, Username|Proxy"
                ) as string
              }
            >
              <HiDownload className="text-base" />
              {t("Xuất danh sách tài khoản")}
            </button>
            <button
              type="button"
              onClick={() => void handleRefreshCookiesBatch()}
              disabled={loading || cookieRefreshBusy || bulkBusy || filteredProfiles.length === 0}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-amber-800 bg-amber-50 rounded-lg border border-amber-300 hover:bg-amber-100 disabled:opacity-50"
              title={
                t(
                  "Cập nhật cookie hàng loạt — chỉ profile còn dưới 3 ngày. Còn login thì bỏ qua."
                ) as string
              }
            >
              <MdOutlineCookie className={`text-base ${cookieRefreshBusy ? "animate-pulse" : ""}`} />
              {cookieRefreshBusy && cookieRefreshProgress
                ? `${t("Đang cập nhật cookies") as string} ${cookieRefreshProgress.done}/${cookieRefreshProgress.total}`
                : (t("Cập nhật Cookies") as string)}
            </button>
          </div>
          <p className="m-0 text-xs text-gray-500">
            {t("Dữ liệu + thao tác qua GPM Login API v1 (Local Agent)")}
          </p>
        </div>
      </div>

      <PanelListCard>
        {loading && profiles.length === 0 ? (
          <div className={panelListClasses.empty}>{t("Đang tải profile từ GPM Login…")}</div>
        ) : profiles.length === 0 ? (
          <div className={panelListClasses.empty}>
            {t("Chưa có profile — tạo từ tab Quản lý tài khoản")}
          </div>
        ) : (
          <>
            {selectedCount > 0 ? (
              <ProfileBulkToolbar
                count={selectedCount}
                bulkBusy={bulkBusy}
                canEditOne={selectedCount === 1}
                canRemotePort={selectedCount === 1}
                onClear={clearSelection}
                onStart={() => void handleBulkStart()}
                onStop={() => void handleBulkStop()}
                onExport={handleBulkExport}
                onEditAction={handleBulkEditAction}
                onCopyAction={handleBulkCopyAction}
                onDelete={() => void handleBulkDelete()}
                onToolsAction={handleBulkToolsAction}
              />
            ) : null}
            <PanelListToolbar
              trailing={
                <PanelListMatchCount
                  term={normalizedTerm}
                  matched={filteredProfiles.length}
                  total={profiles.length}
                />
              }
            >
              <PanelListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("Tìm tên profile / username / proxy / SPC_F / tag...") as string}
              />
            </PanelListToolbar>

            <div className="overflow-x-auto">
              <table className={panelListClasses.table} style={{ minWidth: 1450 }}>
                <thead>
                  <tr className={panelListClasses.theadTr}>
                    <th className={`${panelListClasses.th} w-12`}>
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        onChange={(e) => toggleSelectVisible(e.target.checked)}
                        className={panelListClasses.checkbox}
                      />
                    </th>
                    <th className={`${panelListClasses.th} text-left min-w-[220px]`}>
                      {t("Tên profile")}
                    </th>
                    <th className={`${panelListClasses.th} text-left`}>Proxy</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Trạng thái")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Lần chạy cuối")}</th>
                    <th className={`${panelListClasses.th} text-left min-w-[320px]`}>
                      {t("Thông tin đã lưu")}
                    </th>
                    <th className={`${panelListClasses.th} text-left`}>Tags</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Ghi chú")}</th>
                    <th className={`${panelListClasses.th} text-right min-w-[140px]`}>
                      {t("Thao tác")}
                    </th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {filteredProfiles.length === 0 ? (
                    <tr>
                      <td colSpan={9} className={panelListClasses.emptyMatch}>
                        {t("Không có profile nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filteredProfiles.map((p) => {
                      const isRunning = Boolean(runningMap[p.id]);
                      const isBusy = busyIds.has(p.id);
                      const savedInfo = getProfileSavedInfo(p, userByProfileId.get(p.id));
                      const groupName = p.groupId
                        ? groupNameById.get(p.groupId) || p.groupId
                        : t("Default group");
                      return (
                        <tr
                          key={p.id}
                          className={panelListRowClass({ selected: selectedIds.has(p.id) })}
                        >
                          <td className={panelListClasses.td}>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(p.id)}
                              onChange={(e) => toggleSelectOne(p.id, e.target.checked)}
                              className={panelListClasses.checkbox}
                            />
                          </td>
                          <td className={panelListClasses.td}>
                            <div className="flex gap-3 items-center min-w-0">
                              <ProfileBrowserBadge
                                browserName={p.browserName}
                                browserVersion={p.browserVersion}
                                os={p.os}
                              />
                              <div className="min-w-0">
                                <div className="font-semibold text-gray-900 truncate">{p.name}</div>
                                <div className="text-xs text-gray-400 truncate">{groupName}</div>
                              </div>
                            </div>
                          </td>
                          <td className={panelListClasses.td}>
                            <span
                              className={`text-sm ${
                                p.rawProxy ? "text-gray-700" : "text-gray-400"
                              }`}
                              title={p.rawProxy || undefined}
                            >
                              {proxyLabel(p.rawProxy)}
                            </span>
                          </td>
                          <td className={panelListClasses.td}>
                            <span className="inline-flex gap-1.5 items-center text-sm">
                              <span
                                className={`w-2 h-2 rounded-full ${
                                  isRunning ? "bg-success" : "bg-gray-300"
                                }`}
                              />
                              <span className={isRunning ? "text-success" : "text-gray-500"}>
                                {isRunning ? t("Đang mở") : t("Đã đóng")}
                              </span>
                            </span>
                          </td>
                          <td className={panelListClasses.td}>
                            <span className="inline-flex gap-1 items-center text-sm text-gray-600">
                              <HiClock className="text-gray-400 shrink-0" />
                              {formatRelativeTime(p.updatedAt || p.createdAt)}
                            </span>
                          </td>
                          <td className={panelListClasses.td}>
                            {savedInfo.source === "none" ? (
                              <span className="text-xs text-gray-400">—</span>
                            ) : (
                              <div className="space-y-1 min-w-0 text-xs">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  <span className="inline-flex px-2 py-0.5 font-medium text-sky-700 bg-sky-50 rounded-full">
                                    {savedInfo.username || "Không có username"}
                                  </span>
                                  <span
                                    className="inline-flex px-2 py-0.5 font-medium rounded-full"
                                    style={{
                                      color: getCookieLifeColor(savedInfo.cookieRemainingMs),
                                      backgroundColor: "rgba(248,250,252,0.95)",
                                    }}
                                  >
                                    {savedInfo.cookieFetchedAt
                                      ? `${formatCookieRemaining(savedInfo.cookieRemainingMs)} / 6 ngày`
                                      : "Chưa có thời gian cookie"}
                                  </span>
                                </div>
                                <div className="text-gray-600 truncate">
                                  <span className="font-medium text-gray-700">SPC_F:</span>{" "}
                                  {maskSecret(savedInfo.spcF)}
                                </div>
                                <div className="text-gray-600 truncate">
                                  <span className="font-medium text-gray-700">Proxy:</span>{" "}
                                  {savedInfo.proxy || "No Proxy"}
                                </div>
                                <div className="text-gray-600 truncate">
                                  <span className="font-medium text-gray-700">Cookie:</span>{" "}
                                  {savedInfo.cookie ? `${savedInfo.cookie.length} ký tự` : "—"}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setViewProfile(p)}
                                  className="px-2 py-1 text-xs font-medium text-emerald-700 rounded border border-emerald-200 hover:bg-emerald-50"
                                >
                                  {t("Xem thông tin")}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className={panelListClasses.td}>
                            <span className="text-xs text-gray-500">
                              {p.tags?.length ? p.tags.join(", ") : "—"}
                            </span>
                          </td>
                          <td
                            className="px-4 py-3 text-xs truncate text-gray-600"
                            style={{ maxWidth: 160 }}
                            title={p.note || undefined}
                          >
                            {p.note || "—"}
                          </td>
                          <td className={`${panelListClasses.td} text-right`}>
                            <div className="inline-flex gap-1.5 items-center justify-end">
                              {isRunning ? (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStop(p)}
                                  className="inline-flex gap-1 items-center px-2.5 h-8 text-xs font-semibold text-white rounded-md shadow-sm hover:opacity-90 disabled:opacity-50"
                                  style={{ backgroundColor: "#dc2626" }}
                                >
                                  <HiStop />
                                  {t("Đóng")}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => void handleStart(p)}
                                  className="inline-flex gap-1 items-center px-2.5 h-8 text-xs font-semibold text-emerald-600 bg-white rounded-md border border-emerald-500 hover:bg-emerald-50 disabled:opacity-50"
                                >
                                  <HiPlay />
                                  {t("Mở")}
                                </button>
                              )}
                              <ProfileActionMenu
                                onAction={(action) => void handleProfileAction(p, action)}
                              />
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelListCard>

      <Dialog
        isOpen={Boolean(viewProfile)}
        onClose={() => setViewProfile(null)}
        title={t("Thông tin đã lưu của profile") as string}
        width={760}
      >
        <Dialog.Body>
          {viewProfile ? (
            (() => {
              const info = getProfileSavedInfo(viewProfile, userByProfileId.get(viewProfile.id));
              return (
                <div className="space-y-3">
                  <div className="text-sm">
                    <div className="font-semibold text-gray-900">{viewProfile.name}</div>
                    <div className="text-xs text-gray-500">
                      {info.source === "account"
                        ? "Nguồn: dữ liệu tài khoản đã lưu"
                        : info.source === "note"
                        ? "Nguồn: ghi chú profile GPM"
                        : "Chưa có dữ liệu"}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Username</span>
                      <input
                        readOnly
                        value={info.username || ""}
                        className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 bg-gray-50"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">{t("Mật khẩu")}</span>
                      <input
                        readOnly
                        value={info.password || ""}
                        className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 bg-gray-50"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">SPC_F</span>
                      <input
                        readOnly
                        value={info.spcF || ""}
                        className="px-3 py-2 mt-1 w-full font-mono text-sm rounded-lg border border-gray-300 bg-gray-50"
                      />
                    </label>
                    <label className="block">
                      <span className="text-sm font-medium text-gray-700">Proxy</span>
                      <input
                        readOnly
                        value={info.proxy || ""}
                        className="px-3 py-2 mt-1 w-full font-mono text-sm rounded-lg border border-gray-300 bg-gray-50"
                      />
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-gray-700">
                        {t("Cookie cập nhật")}
                      </span>
                      <div className="flex flex-wrap gap-2 items-center mt-1">
                        <input
                          readOnly
                          value={info.cookieFetchedAt || ""}
                          className="px-3 py-2 flex-1 min-w-[260px] text-sm rounded-lg border border-gray-300 bg-gray-50"
                        />
                        <span
                          className="inline-flex px-2.5 py-2 text-sm font-semibold rounded-lg border"
                          style={{
                            color: getCookieLifeColor(info.cookieRemainingMs),
                            borderColor: "#d1d5db",
                            backgroundColor: "#f8fafc",
                          }}
                        >
                          {info.cookieFetchedAt
                            ? `${formatCookieRemaining(info.cookieRemainingMs)} / 6 ngày`
                            : "Chưa có"}
                        </span>
                      </div>
                    </label>
                    <label className="block md:col-span-2">
                      <span className="text-sm font-medium text-gray-700">Cookies</span>
                      <textarea
                        readOnly
                        value={info.cookie || ""}
                        rows={8}
                        className="px-3 py-2 mt-1 w-full font-mono text-xs rounded-lg border border-gray-300 bg-gray-50"
                      />
                    </label>
                  </div>
                  <div className="flex justify-end pt-2">
                    <button
                      type="button"
                      onClick={() => setViewProfile(null)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
                    >
                      {t("Đóng")}
                    </button>
                  </div>
                </div>
              );
            })()
          ) : null}
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={Boolean(editProfile)}
        onClose={() => setEditProfile(null)}
        title={t("Sửa profile") as string}
        width={520}
      >
        <Dialog.Body>
          <div className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("Tên profile")}</span>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("Nhóm")}</span>
              <select
                value={editGroupId}
                onChange={(e) => setEditGroupId(e.target.value)}
                className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
              >
                <option value="">{t("Mặc định")}</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">Proxy</span>
              <input
                value={editProxy}
                onChange={(e) => setEditProxy(e.target.value)}
                placeholder="host:port:user:pass hoặc socks5://..."
                className="px-3 py-2 mt-1 w-full font-mono text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
              />
            </label>
            <label className="block">
              <span className="text-sm font-medium text-gray-700">{t("Ghi chú")}</span>
              <textarea
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                rows={3}
                className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
              />
            </label>
            <div className="flex gap-2 justify-end pt-2">
              <button
                type="button"
                onClick={() => setEditProfile(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                onClick={() => void handleSaveEdit()}
                disabled={!editName.trim()}
                className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-50"
              >
                {t("Lưu")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={Boolean(remotePortProfile)}
        onClose={() => setRemotePortProfile(null)}
        title={t("Chạy với remote port") as string}
        width={420}
      >
        <Dialog.Body>
          <p className="m-0 text-sm text-gray-600">
            {t("Mở profile với cổng CDP cố định (Selenium / Puppeteer).")}
          </p>
          <label className="block mt-3">
            <span className="text-sm font-medium text-gray-700">Remote debugging port</span>
            <input
              type="number"
              min={1024}
              max={65535}
              value={remotePortValue}
              onChange={(e) => setRemotePortValue(e.target.value)}
              className="px-3 py-2 mt-1 w-full font-mono text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
            />
          </label>
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => setRemotePortProfile(null)}
              className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              onClick={() => {
                if (!remotePortProfile) return;
                const port = Number(remotePortValue);
                if (!Number.isFinite(port) || port < 1024 || port > 65535) {
                  toast.error(t("Port không hợp lệ (1024–65535)") as string);
                  return;
                }
                setRemotePortProfile(null);
                void handleStart(remotePortProfile, port);
              }}
              className="px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
            >
              {t("Mở profile")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={bulkMoveGroupOpen}
        onClose={() => setBulkMoveGroupOpen(false)}
        title={t("Đổi nhóm profile") as string}
        width={420}
      >
        <Dialog.Body>
          <p className="m-0 text-sm text-gray-600">
            {t("Áp dụng nhóm mới cho {{count}} profile đã chọn", { count: selectedCount })}
          </p>
          <label className="block mt-3">
            <span className="text-sm font-medium text-gray-700">{t("Nhóm")}</span>
            <select
              value={bulkMoveGroupId}
              onChange={(e) => setBulkMoveGroupId(e.target.value)}
              className="px-3 py-2 mt-1 w-full text-sm rounded-lg border border-gray-300 outline-none focus:border-emerald-500"
            >
              <option value="">{t("Mặc định")}</option>
              {groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2 justify-end pt-4">
            <button
              type="button"
              onClick={() => setBulkMoveGroupOpen(false)}
              className="px-4 py-2 text-sm font-medium text-gray-700 rounded-lg border border-gray-300 hover:bg-gray-50"
            >
              {t("Hủy")}
            </button>
            <button
              type="button"
              onClick={() => void handleBulkMoveGroupSave()}
              disabled={bulkBusy}
              className="px-4 py-2 text-sm font-bold text-white rounded-lg bg-primary hover:bg-primary-dark disabled:opacity-50"
            >
              {t("Lưu")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
