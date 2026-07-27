import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiDesktopComputer,
  HiDownload,
  HiOutlineTrash,
  HiPencil,
  HiPlus,
  HiRefresh,
  HiUpload,
} from "react-icons/hi";
import { RiArrowDownSLine, RiFileTextLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Switch } from "../../shared/utilities/form";
import { Popover } from "../../shared/utilities/popover/popover";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import {
  createGpmLoginGroupAction,
  createGpmProfileFromUser,
  downloadCsvText,
  fetchGpmLoginGroups,
  fetchGpmLoginProfiles,
  GpmLoginGroupOption,
} from "../scrape/api";
import {
  PanelListCard,
  PanelListMatchCount,
  PanelListSearch,
  PanelListToolbar,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusProxy, AffiliatePlusUser, extractSpcFFromCookie, formatMaybeExcelDate, getShopeeHostByDomain, normalizeMailKp, normalizeShopeeAccountDomain, parseBacVietTheoExcelColumns, parseCompoundMailKpCookie, parseUserImportLine, resolveAccountOriginCookie, resolveAccountSpcF, resolveUserCookie, resolveUserProxy, SHOPEE_ACCOUNT_DOMAINS } from "../types";
import { UsersProfilesPanel } from "./users-profiles-panel";

interface UsersPanelProps {
  users: AffiliatePlusUser[];
  proxies: AffiliatePlusProxy[];
  onUpdateUsers: (users: AffiliatePlusUser[]) => void;
}

/** Profile GPM còn tồn tại (đối chiếu API, không dựa cdpPort cũ trên tài khoản). */
function isGpmProfileLinked(user: AffiliatePlusUser, validGpmIds: Set<string>): boolean {
  const id = String(user.gpmProfileId || "").trim();
  return Boolean(id && validGpmIds.has(id));
}

/** Xóa gpmProfileId/cdpPort lưu local nếu profile đã bị xóa khỏi GPM. */
function stripStaleGpmLink(user: AffiliatePlusUser, validGpmIds: Set<string>): AffiliatePlusUser {
  if (isGpmProfileLinked(user, validGpmIds)) return user;
  const id = String(user.gpmProfileId || "").trim();
  const port = Number(user.cdpPort || 0);
  const hasStalePort = Number.isFinite(port) && port > 0;
  if (!id && !hasStalePort) return user;
  const next = { ...user };
  delete next.gpmProfileId;
  delete next.cdpPort;
  return next;
}

function syncUsersWithGpmProfiles(
  users: AffiliatePlusUser[],
  validGpmIds: Set<string>
): { users: AffiliatePlusUser[]; changed: boolean } {
  let changed = false;
  const next = users.map((u) => {
    const synced = stripStaleGpmLink(u, validGpmIds);
    if (synced !== u) changed = true;
    return synced;
  });
  return { users: changed ? next : users, changed };
}

/**
 * Mẫu Excel kiểu "100 ac bác việt theo" (không header):
 * A Username | B mail | C mailkp|pass|cookie|uuid | D trống | E ngày | F mk | G spc_f | H domain
 */
const SAMPLE_BAC_VIET_EXCEL_ROWS = [
  [
    "gibnxd51ot",
    "markeith-bn16121990@hotmail.com",
    "markeith-bn16121990@hotmail.com|afkqfpgkn8|FULL_COOKIE_SAMPLE_1|9e5f94bc-e8a4-4e73-b8be-63364c29d753",
    "",
    "2026-07-07 19:15:02",
    "Minh123@",
    "EAsaDA1UACjgQLtXKKDM3UujgaQpZ2Ss",
    ".vn",
  ],
  [
    "vu73mc3lci",
    "blaine_te07091997@hotmail.com",
    "blaine_te07091997@hotmail.com|vuktrurva1|FULL_COOKIE_SAMPLE_2|9e5f94bc-e8a4-4e73-b8be-63364c29d753",
    "",
    "2026-07-07 19:15:41",
    "Minh123@",
    "beHy4ScKAI5mczkDrFAIMujdLr7l0JtB",
    ".ph",
  ],
];

const SAMPLE_USERS_ROWS = [
  [
    "ACC001",
    "vn",
    "acc001@example.com",
    "acc001-kp@example.com",
    "FULL_COOKIE_SAMPLE_1",
    "2026-07-16 10:00:00",
    "MailPass001",
    "spc_f_sample_1",
  ],
  [
    "ACC002",
    "ph",
    "acc002@example.com",
    "acc002-kp@example.com",
    "FULL_COOKIE_SAMPLE_2",
    "2026-07-16 10:05:00",
    "MailPass002",
    "spc_f_sample_2",
  ],
];

const SAMPLE_USERS_CSV =
  "\uFEFF" +
  [
    "Username,mail,mailkp,cookie,ngay tao,mat khau,Cookie spc_f,domain",
    ...SAMPLE_USERS_ROWS.map((r) =>
      // SAMPLE_USERS_ROWS: username, domain, mail, mailkp, cookie, date, pass, spc
      [r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[1]].join(",")
    ),
  ].join("\n");

const SAMPLE_USERS_TXT =
  [
    "Username|mail|mailkp|cookie|ngay tao|mat khau|Cookie spc_f|domain",
    ...SAMPLE_USERS_ROWS.map((r) =>
      [r[0], r[2], r[3], r[4], r[5], r[6], r[7], r[1]].join("|")
    ),
  ].join("\n") + "\n";

/** Mẫu TXT kiểu bác việt theo — cột phân tách TAB, cột H = domain */
const SAMPLE_BAC_VIET_TXT =
  SAMPLE_BAC_VIET_EXCEL_ROWS.map((r) => r.join("\t")).join("\n") + "\n";

async function downloadSampleExcel() {
  try {
    const mod: any = await import("xlsx");
    const XLSX = mod?.default ?? mod;
    const ws = XLSX.utils.aoa_to_sheet(SAMPLE_BAC_VIET_EXCEL_ROWS);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, "mau-quan-ly-nguoi-dung.xlsx");
  } catch {
    // fallback CSV nếu xlsx lỗi
    downloadCsvText(SAMPLE_USERS_CSV, "mau-quan-ly-nguoi-dung.csv");
  }
}

function downloadSampleTxt() {
  // TXT bác việt theo: TAB-separated, cột H = domain (giống Excel)
  const blob = new Blob([SAMPLE_BAC_VIET_TXT], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-quan-ly-nguoi-dung.txt";
  a.click();
  URL.revokeObjectURL(url);
}

/** Gán mỗi user một proxy duy nhất từ pool (không trùng lắp). */
function syncUsersWithUniqueProxies(
  users: AffiliatePlusUser[],
  proxies: AffiliatePlusProxy[]
): { next: AffiliatePlusUser[]; assigned: number; skipped: number } {
  const pool = proxies
    .filter((p) => p.active !== false && String(p.raw || "").trim())
    .map((p) => String(p.raw).trim());

  const uniquePool: string[] = [];
  const seenPool = new Set<string>();
  for (const raw of pool) {
    const key = raw.toLowerCase();
    if (seenPool.has(key)) continue;
    seenPool.add(key);
    uniquePool.push(raw);
  }

  const used = new Set<string>();
  const next = users.map((u) => ({ ...u }));

  // Pass 1: giữ proxy hiện có nếu còn trong pool và chưa bị user khác chiếm
  for (const user of next) {
    const current = resolveUserProxy(user);
    if (!current) continue;
    const key = current.toLowerCase();
    const stillInPool = uniquePool.some((p) => p.toLowerCase() === key);
    if (stillInPool && !used.has(key)) {
      used.add(key);
      user.proxy = uniquePool.find((p) => p.toLowerCase() === key) || current;
    } else {
      user.proxy = "";
    }
  }

  // Pass 2: gán proxy còn trống theo thứ tự
  let poolIdx = 0;
  const takeFree = (): string | null => {
    while (poolIdx < uniquePool.length) {
      const raw = uniquePool[poolIdx++];
      const key = raw.toLowerCase();
      if (used.has(key)) continue;
      used.add(key);
      return raw;
    }
    return null;
  };

  let assigned = 0;
  let skipped = 0;
  for (const user of next) {
    if (resolveUserProxy(user)) {
      assigned++;
      continue;
    }
    const free = takeFree();
    if (free) {
      user.proxy = free;
      assigned++;
    } else {
      skipped++;
    }
  }

  return { next, assigned, skipped };
}

export function UsersPanel({ users, proxies, onUpdateUsers }: UsersPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();
  const txtInputRef = useRef<HTMLInputElement>(null);
  const excelInputRef = useRef<HTMLInputElement>(null);
  const addMenuRef = useRef<HTMLButtonElement>(null);
  const [addMenuOpen, setAddMenuOpen] = useState(false);
  const [editUser, setEditUser] = useState<AffiliatePlusUser | null>(null);
  const [form, setForm] = useState({
    username: "",
    mail: "",
    mailKp: "",
    cookie: "",
    cookieApp: "",
    password: "",
    spcF: "",
    domain: "vn",
    proxy: "",
    createdAt: "",
  });
  const [isNew, setIsNew] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [usersSubTab, setUsersSubTab] = useState(0);
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchGroups, setBatchGroups] = useState<GpmLoginGroupOption[]>([]);
  const [batchGroupId, setBatchGroupId] = useState("");
  const [batchGroupsLoading, setBatchGroupsLoading] = useState(false);
  const [batchTargetCount, setBatchTargetCount] = useState(0);
  const [batchSkipCreated, setBatchSkipCreated] = useState(0);
  const [batchSkipMissing, setBatchSkipMissing] = useState(0);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const usersRef = useRef(users);
  usersRef.current = users;

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const getUserCreatePayload = (user: AffiliatePlusUser) => {
    const accountName = String(user.username || user.mail || user.email || "").trim();
    const domain = normalizeShopeeAccountDomain(user.domain);
    const host = getShopeeHostByDomain(domain);
    const profileName = accountName ? `${accountName} · ${host}` : "";
    const cookie = resolveAccountOriginCookie(user);
    const spcF = resolveAccountSpcF(user);
    const username = String(user.username || "").trim() || accountName;
    const password = String(user.password || "").trim();
    return { profileName, accountName, cookie, spcF, domain, username, password };
  };

  const canCreateGpmProfile = (user: AffiliatePlusUser) => {
    const { accountName, cookie, spcF } = getUserCreatePayload(user);
    return Boolean(accountName && (cookie || spcF) && spcF);
  };

  const applyUserProfileResult = (userId: string, patch: Partial<AffiliatePlusUser>) => {
    const next = usersRef.current.map((u) => (u.id === userId ? { ...u, ...patch } : u));
    usersRef.current = next;
    onUpdateUsers(next);
  };

  /** Luôn mở Dialog — đối chiếu GPM thực tế trước khi đếm «đã tạo». */
  const handleOpenBatchCreateDialog = async () => {
    if (batchCreating) return;

    setNewGroupName("");
    setBatchDialogOpen(true);
    setBatchGroupsLoading(true);
    try {
      const [groups, gpmProfiles] = await Promise.all([
        fetchGpmLoginGroups(),
        fetchGpmLoginProfiles(),
      ]);
      const validGpmIds = new Set(gpmProfiles.map((p) => p.id));

      const { users: syncedUsers, changed } = syncUsersWithGpmProfiles(
        usersRef.current,
        validGpmIds
      );
      if (changed) {
        usersRef.current = syncedUsers;
        onUpdateUsers(syncedUsers);
      }

      const checked = syncedUsers.filter((u) => selectedIds.has(u.id));
      const eligible = checked.filter(canCreateGpmProfile);
      const targets = eligible.filter((u) => !isGpmProfileLinked(u, validGpmIds));
      const alreadyDone = eligible.length - targets.length;
      const missingData = checked.length - eligible.length;

      setBatchTargetCount(targets.length);
      setBatchSkipCreated(alreadyDone);
      setBatchSkipMissing(missingData);

      setBatchGroups(groups);
      setBatchGroupId((prev) => {
        if (prev && groups.some((g) => g.id === prev)) return prev;
        return groups[0]?.id || "";
      });
    } catch (err: any) {
      setBatchGroups([]);
      setBatchGroupId("");
      setBatchTargetCount(0);
      setBatchSkipCreated(0);
      setBatchSkipMissing(0);
      toast.error(String(err?.message || err || "Không tải được nhóm profile"));
    } finally {
      setBatchGroupsLoading(false);
    }
  };

  const handleCreateNewBatchGroup = async () => {
    const name = newGroupName.trim();
    if (!name || creatingGroup) return;
    setCreatingGroup(true);
    try {
      const group = await createGpmLoginGroupAction({ name });
      setBatchGroups((prev) => {
        const next = [group, ...prev.filter((g) => g.id !== group.id)];
        return next;
      });
      setBatchGroupId(group.id);
      setNewGroupName("");
      toast.success(`${t("Đã tạo nhóm") as string}: ${group.name}`);
    } catch (err: any) {
      toast.error(String(err?.message || err || "Không tạo được nhóm"));
    } finally {
      setCreatingGroup(false);
    }
  };

  /** Hàng loạt: chỉ tạo cho tài khoản đã check + chưa có profile GPM, gắn vào nhóm đã chọn. */
  const handleCreateAllGpmProfiles = async (groupId: string) => {
    if (batchCreating) return;
    const selectedGroupId = String(groupId || "").trim();
    if (!selectedGroupId) {
      toast.warn(t("Chọn nhóm Profile trước khi tạo") as string);
      return;
    }

    if (!selectedIds.size) {
      toast.warn(t("Hãy chọn (check) ít nhất 1 tài khoản trước khi tạo Profile") as string);
      return;
    }

    let currentUsers = usersRef.current;
    let validGpmIds = new Set<string>();
    try {
      const gpmProfiles = await fetchGpmLoginProfiles();
      validGpmIds = new Set(gpmProfiles.map((p) => p.id));
      const { users: syncedUsers, changed } = syncUsersWithGpmProfiles(currentUsers, validGpmIds);
      if (changed) {
        currentUsers = syncedUsers;
        usersRef.current = syncedUsers;
        onUpdateUsers(syncedUsers);
      }
    } catch {
      // Agent/GPM offline — vẫn cho tạo nếu chưa có gpmProfileId
    }

    const checked = currentUsers.filter((u) => selectedIds.has(u.id));
    const eligible = checked.filter(canCreateGpmProfile);
    const targets = eligible.filter((u) => !isGpmProfileLinked(u, validGpmIds));
    const alreadyDone = eligible.length - targets.length;
    const missingData = checked.length - eligible.length;

    if (!targets.length) {
      toast.warn(
        t("Trong các tài khoản đã chọn không còn tài khoản nào đủ dữ liệu để tạo profile") as string
      );
      return;
    }

    setBatchDialogOpen(false);
    setBatchCreating(true);
    setBatchProgress({ done: 0, total: targets.length });
    let ok = 0;
    let fail = 0;

    try {
      for (let i = 0; i < targets.length; i++) {
        const user = targets[i];
        setBatchProgress({ done: i, total: targets.length });
        const { profileName, cookie, spcF, domain, username, password } = getUserCreatePayload(user);
        try {
          const result = await createGpmProfileFromUser({
            profileName,
            domain,
            cookie: cookie || undefined,
            spcF: spcF || undefined,
            username: username || undefined,
            password: password || undefined,
            proxy: resolveUserProxy(user) || undefined,
            note: user.mail || user.email || undefined,
            groupId: selectedGroupId,
            keepOpen: false,
          });
          applyUserProfileResult(user.id, {
            gpmProfileId: result.profileId,
            cdpPort: result.profileStopped ? undefined : result.cdpPort || undefined,
            error: "",
            ...(result.savedSession && result.loggedIn
              ? {
                  username: result.savedSession.username || user.username,
                  password: result.savedSession.password || user.password,
                  cookie: result.savedSession.cookie || user.cookie,
                  cookieApp: result.savedSession.cookie || user.cookieApp,
                  spcF: result.savedSession.spcF || user.spcF,
                  proxy: result.savedSession.proxy || user.proxy,
                  cookieFetchedAt: result.savedSession.cookieFetchedAt,
                }
              : {}),
          });
          ok += 1;
        } catch (err: any) {
          const msg = String(err?.message || err || "Tạo profile thất bại");
          applyUserProfileResult(user.id, { error: msg });
          fail += 1;
        }
        setBatchProgress({ done: i + 1, total: targets.length });
        if (i < targets.length - 1) {
          await new Promise((r) => setTimeout(r, 800));
        }
      }

      const skipHint =
        alreadyDone + missingData > 0
          ? ` · ${t("bỏ qua") as string} ${alreadyDone + missingData}`
          : "";
      if (fail === 0) {
        toast.success(
          `${t("Tạo Profile tự động xong") as string}: ${ok}/${targets.length}${skipHint}`
        );
      } else {
        toast.warn(
          `${t("Tạo Profile tự động") as string}: ${t("thành công") as string} ${ok}, ${
            t("lỗi") as string
          } ${fail}${skipHint}`
        );
      }
    } finally {
      setBatchCreating(false);
      setBatchProgress(null);
    }
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active !== false).length;
    const inactive = total - active;
    const withProxy = users.filter((u) => Boolean(resolveUserProxy(u))).length;
    return { total, active, inactive, withProxy };
  }, [users]);

  const normalizedTerm = useMemo(() => searchTerm.toLowerCase(), [searchTerm]);

  const filteredUsers = useMemo(() => {
    if (!normalizedTerm) return users;
    return users.filter((user) => {
      const haystack = [
        user.username,
        user.domain,
        user.mail || user.email,
        user.mailKp,
        user.cookie,
        user.password,
        user.spcF,
        resolveUserProxy(user),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedTerm);
    });
  }, [users, normalizedTerm]);

  const allVisibleSelected =
    filteredUsers.length > 0 && filteredUsers.every((u) => selectedIds.has(u.id));

  const toggleSelectVisible = (checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      filteredUsers.forEach((u) => {
        if (checked) next.add(u.id);
        else next.delete(u.id);
      });
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

  const toggleUserActive = (user: AffiliatePlusUser, active: boolean) => {
    onUpdateUsers(users.map((u) => (u.id === user.id ? { ...u, active } : u)));
    toast.success(
      active
        ? t("Đã kích hoạt {{name}}", { name: user.username })
        : t("Đã ngừng kích hoạt {{name}}", { name: user.username })
    );
  };

  const openNew = () => {
    setForm({
      username: "",
      mail: "",
      mailKp: "",
      cookie: "",
      cookieApp: "",
      password: "",
      spcF: "",
      domain: "vn",
      proxy: "",
      createdAt: "",
    });
    setIsNew(true);
    setEditUser({} as AffiliatePlusUser);
  };

  const openEdit = (user: AffiliatePlusUser) => {
    setForm({
      username: user.username,
      mail: user.mail || user.email || "",
      mailKp: normalizeMailKp(user.mailKp),
      cookie: user.cookie || "",
      cookieApp: user.cookieApp || "",
      password: user.password || "",
      spcF: user.spcF || "",
      domain: normalizeShopeeAccountDomain(user.domain),
      proxy: resolveUserProxy(user),
      createdAt: user.createdAt || "",
    });
    setIsNew(false);
    setEditUser(user);
  };

  const handleSave = () => {
    const username = form.username.trim();
    if (!username) {
      toast.warn(t("Vui lòng nhập username"));
      return;
    }
    const dup = users.some(
      (u) =>
        u.username.trim().toLowerCase() === username.toLowerCase() &&
        (isNew || u.id !== editUser?.id)
    );
    if (dup) {
      toast.warn(t("Username đã tồn tại"));
      return;
    }

    if (isNew) {
      onUpdateUsers([
        ...users,
        {
          id: crypto.randomUUID(),
          username,
          email: form.mail.trim(),
          mail: form.mail.trim(),
          role: "user",
          mailKp: normalizeMailKp(form.mailKp),
          cookie: form.cookie.trim(),
          cookieApp: "",
          password: form.password.trim(),
          spcF: extractSpcFFromCookie(form.cookie) || form.spcF.trim(),
          domain: normalizeShopeeAccountDomain(form.domain),
          proxy: form.proxy.trim(),
          error: "",
          active: true,
          createdAt: form.createdAt.trim() || new Date().toISOString(),
          generateItems: [],
          generateItem: null,
        },
      ]);
      toast.success(t("Đã thêm người dùng"));
    } else if (editUser) {
      onUpdateUsers(
        users.map((u) =>
          u.id === editUser.id
            ? {
                ...u,
                username,
                email: form.mail.trim(),
                mail: form.mail.trim(),
                mailKp: normalizeMailKp(form.mailKp),
                cookie: form.cookie.trim(),
                // Giữ cookieApp / generateItems — tab này chỉ sửa tài khoản thô
                password: form.password.trim(),
                spcF:
                  extractSpcFFromCookie(form.cookie) ||
                  form.spcF.trim() ||
                  u.spcF,
                domain: normalizeShopeeAccountDomain(form.domain),
                proxy: form.proxy.trim(),
                createdAt: form.createdAt.trim() || u.createdAt,
                error: "",
              }
            : u
        )
      );
      toast.success(t("Đã cập nhật"));
    }
    setEditUser(null);
  };

  const handleDelete = (id: string) => {
    if (!confirm(t("Xóa người dùng này?"))) return;
    onUpdateUsers(users.filter((u) => u.id !== id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    toast.success(t("Đã xóa"));
  };

  const handleDeleteAll = () => {
    const toDelete =
      selectedIds.size > 0
        ? users.filter((u) => selectedIds.has(u.id))
        : [];
    if (!toDelete.length) {
      toast.warn(t("Hãy chọn (check) các tài khoản cần xóa ở cột bên trái"));
      return;
    }
    if (
      !confirm(
        String(
          t("Xóa {{count}} tài khoản đã chọn? Không hoàn tác được.", {
            count: toDelete.length,
          })
        )
      )
    ) {
      return;
    }
    const removeIds = new Set(toDelete.map((u) => u.id));
    onUpdateUsers(users.filter((u) => !removeIds.has(u.id)));
    setSelectedIds(new Set());
    toast.success(t("Đã xóa {{count}} tài khoản đã chọn", { count: toDelete.length }));
  };

  const normalizeUserHeader = (value: string) =>
    String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/[^a-z0-9_ ]/g, "")
      .replace(/\s+/g, " ")
      .trim();

  const USER_HEADER_ALIASES: Record<string, string[]> = {
    username: ["username", "user", "ten account", "ten nguoi dung", "tai khoan", "account"],
    mail: ["email", "mail", "gmail", "username mail", "mail mail"],
    mailKp: [
      "mailkp",
      "mail kp",
      "mmailkp",
      "mailkhoiphuc",
      "mail khoi phuc",
      "mail khôi phục",
      "khoi phuc",
      "recovery mail",
    ],
    cookie: ["cookie", "cookies", "cookie full", "full cookie", "session cookie"],
    createdAt: ["ngay tao", "ngaty tao", "created at", "created_at", "date created"],
    password: ["password", "mat khau", "mk", "pass"],
    spcF: ["spc_f", "spcf", "cookie spc_f", "spc f", "cookie spc f"],
    domain: ["domain", "quoc gia", "country", "market", "region", "local", "locale"],
    proxy: ["proxy", "host_port", "host port", "hostport"],
    _legacyCompound: ["mail cookie", "mailcookie", "mail cookie sp"],
  };

  const mapUserHeaderToField = (header: string): string | null => {
    const normalized = normalizeUserHeader(header);
    if (!normalized) return null;
    for (const [field, aliases] of Object.entries(USER_HEADER_ALIASES)) {
      if (aliases.some((alias) => normalizeUserHeader(alias) === normalized)) return field;
    }
    return null;
  };

  const isHeaderLine = (line: string) => {
    const lower = line.toLowerCase().replace(/\s+/g, "");
    const parts = splitUserLine(line);
    const mapped = parts.filter((part) => mapUserHeaderToField(part)).length;
    return (
      mapped >= 2 ||
      lower.startsWith("username") ||
      lower.startsWith("user,") ||
      lower.startsWith("user|") ||
      lower.startsWith("tênaccount") ||
      lower.startsWith("tenaccount") ||
      lower === "username,cookie,proxy" ||
      lower === "username|cookie|proxy"
    );
  };

  function splitUserLine(line: string): string[] {
    const trimmed = String(line || "").trim();
    if (!trimmed) return [];

    if (trimmed.includes("\t")) return trimmed.split("\t").map((part) => part.trim());

    if (trimmed.includes(",") && !trimmed.includes("|")) {
      return trimmed.split(",").map((part) => part.trim());
    }

    const pipeCount = (trimmed.match(/\|/g) || []).length;
    if (pipeCount === 2) {
      return trimmed.split("|").map((part) => part.trim());
    }

    if (trimmed.includes("  ")) {
      return trimmed.split(/\s{2,}/).map((part) => part.trim());
    }

    return trimmed.split("|").map((part) => part.trim());
  }

  function buildUserFromRaw(raw: Record<string, string>): AffiliatePlusUser | null {
    const username = String(raw.username || "").trim();
    if (!username) return null;

    let mailKp = normalizeMailKp(raw.mailKp || "");
    let cookie = String(raw.cookie || "").trim();
    const legacyCompound = String(
      raw._legacyCompound || raw.mailCookie || raw["mail cookie"] || ""
    ).trim();
    if (legacyCompound) {
      const parsed = parseCompoundMailKpCookie(legacyCompound);
      if (parsed) {
        mailKp = mailKp || parsed.mailKp;
        cookie = cookie || parsed.cookie;
      } else if (!cookie && !mailKp) {
        mailKp = normalizeMailKp(legacyCompound);
      }
    }
    mailKp = normalizeMailKp(mailKp);
    let spcF = String(raw.spcF || raw.spc_f || "").trim();
    if (!spcF && cookie) spcF = extractSpcFFromCookie(cookie);

    return {
      id: crypto.randomUUID(),
      username,
      email: String(raw.mail || raw.email || "").trim(),
      mail: String(raw.mail || raw.email || "").trim(),
      role: "user",
      mailKp,
      cookie,
      cookieApp: String(raw.cookieApp || raw.cookie_app || "").trim(),
      password: String(raw.password || "").trim(),
      spcF,
      domain: normalizeShopeeAccountDomain(raw.domain || raw.country || raw.local),
      proxy: String(raw.proxy || "").trim(),
      error: "",
      active: true,
      createdAt: String(raw.createdAt || "").trim() || new Date().toISOString(),
      generateItems: [],
      generateItem: null,
    };
  }

  /** Parse TXT/CSV → list user; bỏ header, dòng trống, username rỗng. */
  const parseUserLines = (text: string): AffiliatePlusUser[] => {
    const seen = new Set<string>();
    const list: AffiliatePlusUser[] = [];
    const cleaned = String(text || "").replace(/^\uFEFF/, "");
    let headerMap: (string | null)[] | null = null;

    for (const rawLine of cleaned.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line) continue;

      const parts = splitUserLine(line);
      if (!parts.length) continue;

      if (!headerMap && isHeaderLine(line)) {
        headerMap = parts.map((part) => mapUserHeaderToField(part));
        // Header kiểu "...|Cookie|spc_f" → gộp thành Cookie spc_f
        for (let i = 0; i < parts.length - 1; i++) {
          const a = normalizeUserHeader(parts[i] || "");
          const b = normalizeUserHeader(parts[i + 1] || "");
          if (a === "cookie" && (b === "spc_f" || b === "spcf" || b === "spc f")) {
            // Nếu đã có cột cookie trước đó thì cột Cookie đứng trước spc_f bỏ qua
            const cookieAlready = headerMap.slice(0, i).includes("cookie");
            if (cookieAlready) headerMap[i] = null;
            headerMap[i + 1] = "spcF";
          }
        }
        continue;
      }

      let user: AffiliatePlusUser | null = null;

      if (headerMap?.some(Boolean)) {
        const raw: Record<string, string> = {};
        headerMap.forEach((field, index) => {
          if (!field) return;
          raw[field] = String(parts[index] || "").trim();
        });
        user = buildUserFromRaw(raw);
      } else {
        // Ưu tiên dòng kiểu Excel bác việt theo (cột C compound có |, cột H = domain)
        // Hỗ trợ cả tách bằng TAB (export từ Excel) hoặc đủ cột logic.
        const compoundCell = String(parts[2] || "");
        const looksBacViet =
          parts.length >= 7 &&
          compoundCell.includes("|") &&
          /@/.test(compoundCell);

        let fallbackRaw: Record<string, string>;

        if (looksBacViet) {
          const bac = parseBacVietTheoExcelColumns(parts);
          fallbackRaw = bac
            ? {
                username: bac.username,
                mail: bac.mail || "",
                mailKp: normalizeMailKp(bac.mailKp || ""),
                cookie: bac.cookie || "",
                createdAt: bac.createdAt || "",
                password: bac.password || "",
                spcF: bac.spcF || "",
                domain: bac.domain || "",
                proxy: bac.proxy || "",
              }
            : {
                username: String(parts[0] || "").trim(),
              };
        } else {
          const smart = parseUserImportLine(line);
          if (smart) {
            fallbackRaw = {
              username: smart.username,
              mail: smart.mail || "",
              mailKp: normalizeMailKp(smart.mailKp || ""),
              cookie: smart.cookie || "",
              createdAt: smart.createdAt || "",
              password: smart.password || "",
              spcF: smart.spcF || "",
              domain: smart.domain || "",
              proxy: smart.proxy || "",
            };
          } else if (parts.length >= 7) {
            // Username|mail|mailkp|cookie|ngay tao|mat khau|Cookie spc_f|domain [|proxy]
            fallbackRaw = {
              username: String(parts[0] || "").trim(),
              mail: String(parts[1] || "").trim(),
              mailKp: normalizeMailKp(parts[2] || ""),
              cookie: String(parts[3] || "").trim(),
              createdAt: String(parts[4] || "").trim(),
              password: String(parts[5] || "").trim(),
              spcF: String(parts[6] || "").trim(),
              domain: String(parts[7] || "").trim(),
              proxy: String(parts[8] || "").trim(),
            };
          } else if (parts.length >= 3 && parts[2].includes("|")) {
            const parsed = parseCompoundMailKpCookie(parts[2]);
            fallbackRaw = {
              username: String(parts[0] || "").trim(),
              mail: String(parts[1] || "").trim(),
              mailKp: normalizeMailKp(parsed?.mailKp || parts[2] || ""),
              cookie: parsed?.cookie || "",
              createdAt: String(parts[3] || "").trim(),
              password: String(parts[4] || "").trim(),
              spcF: String(parts[5] || "").trim(),
              domain: String(parts[6] || "").trim(),
              proxy: String(parts[7] || "").trim(),
            };
          } else {
            fallbackRaw = {
              username: String(parts[0] || "").trim(),
              cookie: String(parts[1] || "").trim(),
              proxy: String(parts[2] || "").trim(),
            };
          }
        }

        user = buildUserFromRaw(fallbackRaw);
      }

      if (!user) continue;
      const username = user.username.trim();

      const key = username.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);

      list.push(user);
    }
    return list;
  };

  /**
   * Parse Excel (.xlsx) — hỗ trợ mẫu "bác việt theo" không header:
   * A–G như cũ + H domain (.vn/.ph/...)
   */
  const parseUserExcelRows = (rows: unknown[][]): AffiliatePlusUser[] => {
    const seen = new Set<string>();
    const list: AffiliatePlusUser[] = [];
    let headerMap: (string | null)[] | null = null;

    for (const row of rows) {
      if (!Array.isArray(row)) continue;
      const parts = row.map((cell) => {
        if (cell instanceof Date) return formatMaybeExcelDate(cell);
        return String(cell ?? "").trim();
      });
      if (!parts.some(Boolean)) continue;

      if (!headerMap && isHeaderLine(parts.join("|"))) {
        headerMap = parts.map((part) => mapUserHeaderToField(part));
        continue;
      }

      let user: AffiliatePlusUser | null = null;
      if (headerMap?.some(Boolean)) {
        const raw: Record<string, string> = {};
        headerMap.forEach((field, index) => {
          if (!field) return;
          raw[field] = String(parts[index] || "").trim();
        });
        // Cột compound quen thuộc nếu header map nhầm
        if (raw.mailKp?.includes("|") && !raw.cookie) {
          const parsed = parseCompoundMailKpCookie(raw.mailKp);
          if (parsed) {
            raw.mailKp = parsed.mailKp;
            raw.cookie = parsed.cookie;
          }
        }
        if (raw.createdAt) raw.createdAt = formatMaybeExcelDate(raw.createdAt);
        user = buildUserFromRaw(raw);
      } else {
        const smart = parseBacVietTheoExcelColumns(parts);
        if (smart) {
          user = buildUserFromRaw({
            username: smart.username,
            mail: smart.mail || "",
            mailKp: normalizeMailKp(smart.mailKp || ""),
            cookie: smart.cookie || "",
            createdAt: smart.createdAt || "",
            password: smart.password || "",
            spcF: smart.spcF || "",
            proxy: smart.proxy || "",
            domain: smart.domain || "",
          });
        }
      }

      if (!user) continue;
      const key = user.username.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      list.push(user);
    }
    return list;
  };

  /** Merge import: bỏ trùng username với list hiện có + trong file. */
  const mergeImportedUsers = (imported: AffiliatePlusUser[], sourceLabel: string) => {
    if (!imported.length) {
      toast.warn(t("Không đọc được user từ {{source}}", { source: sourceLabel }));
      return;
    }
    const existing = new Set(users.map((u) => u.username.trim().toLowerCase()).filter(Boolean));
    const fresh = imported.filter((u) => {
      const key = u.username.trim().toLowerCase();
      if (!key || existing.has(key)) return false;
      existing.add(key);
      return true;
    });
    const skipped = imported.length - fresh.length;
    if (!fresh.length) {
      toast.warn(t("Tất cả username đã tồn tại — không thêm mới"));
      return;
    }
    onUpdateUsers([...users, ...fresh]);
    toast.success(
      skipped > 0
        ? t("Đã nhập {{count}} người dùng (bỏ trùng {{skipped}})", {
            count: fresh.length,
            skipped,
          })
        : t("Đã nhập {{count}} người dùng", { count: fresh.length })
    );
  };

  const handleImportTxt = async (file: File) => {
    mergeImportedUsers(parseUserLines(await file.text()), "TXT");
  };

  const handleImportExcel = async (file: File) => {
    const name = file.name.toLowerCase();
    if (name.endsWith(".csv") || file.type === "text/csv") {
      mergeImportedUsers(parseUserLines(await file.text()), "CSV");
      return;
    }
    try {
      const mod: any = await import("xlsx");
      const XLSX = mod?.default ?? mod;
      const data = new Uint8Array(await file.arrayBuffer());
      const workbook = XLSX.read(data, { type: "array", raw: false, cellDates: true });
      const sheetName = workbook.SheetNames?.[0];
      if (!sheetName) {
        toast.warn(t("File Excel không có sheet"));
        return;
      }
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, {
        header: 1,
        defval: "",
        raw: false,
      }) as unknown[][];
      mergeImportedUsers(parseUserExcelRows(rows), "Excel");
    } catch (err: any) {
      toast.error(err?.message || t("Không đọc được file Excel (.xlsx)"));
    }
  };

  const handleSyncProxies = () => {
    if (!users.length) {
      toast.warn(t("Chưa có người dùng để đồng bộ"));
      return;
    }
    const activeProxies = proxies.filter((p) => p.active !== false && String(p.raw || "").trim());
    if (!activeProxies.length) {
      toast.warn(t("Chưa có proxy trong tab Quản lý Proxy"));
      return;
    }

    const { next, assigned, skipped } = syncUsersWithUniqueProxies(users, proxies);
    onUpdateUsers(next);

    if (skipped > 0) {
      toast.warn(
        t("Đã gán {{assigned}} proxy (thiếu {{skipped}} — thêm proxy hoặc giảm account)", {
          assigned,
          skipped,
        })
      );
    } else {
      toast.success(
        t("Đã đồng bộ {{count}} account ↔ proxy (1-1, không trùng)", { count: assigned })
      );
    }
  };

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <TabGroup
          name="users-management-sub"
          index={usersSubTab}
          onChange={setUsersSubTab}
          flex
          hasInkBar={false}
          className="!bg-transparent"
          tabClassName="h-11 justify-center border-r border-gray-200 last:border-r-0 bg-gray-50"
          activeClassName="!text-primary-dark bg-success-light"
          titleClassName="text-sm font-bold whitespace-nowrap"
          bodyClassName="border-t border-gray-200 bg-white"
        >
          <TabGroup.Tab label={t("Quản lý tài khoản")}>
            <div className="p-4 space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          {
            label: t("Tổng"),
            value: stats.total,
            bg: "#e0f2fe",
            border: "#38bdf8",
            text: "#0284c7",
            dot: "#0ea5e9",
          },
          {
            label: t("Đang bật"),
            value: stats.active,
            bg: "#ecfdf5",
            border: "#34d399",
            text: "#059669",
            dot: "#10b981",
          },
          {
            label: t("Có Proxy"),
            value: stats.withProxy,
            bg: "#fdf4ff",
            border: "#e879f9",
            text: "#c026d3",
            dot: "#d946ef",
          },
          {
            label: t("Tắt"),
            value: stats.inactive,
            bg: "#f8fafc",
            border: "#cbd5e1",
            text: "#475569",
            dot: "#94a3b8",
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
            <input
              ref={txtInputRef}
              type="file"
              accept=".txt,text/plain"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportTxt(file);
                e.target.value = "";
              }}
            />
            <input
              ref={excelInputRef}
              type="file"
              accept=".csv,.xlsx,.xls,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImportExcel(file);
                e.target.value = "";
              }}
            />

            {/* Gộp: Thêm thủ công / Nhập Excel / Nhập TXT */}
            <button
              ref={addMenuRef}
              type="button"
              onClick={() => setAddMenuOpen((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              <HiPlus className="text-base" />
              {t("Thêm / Nhập")}
              <RiArrowDownSLine className="text-sm opacity-80" />
            </button>
            <Popover
              reference={addMenuRef}
              trigger="click"
              placement="bottom-start"
              arrow={false}
              maxWidth={280}
              visible={addMenuOpen}
              hideOnClickOutside
              zIndex={10050}
              onHidden={() => setAddMenuOpen(false)}
              onClickOutside={() => setAddMenuOpen(false)}
            >
              <div className="py-1 min-w-[240px]">
                {[
                  {
                    label: t("Thêm Người Dùng"),
                    hint: t("Nhập thủ công Username / mail / mailkp / cookie / ..."),
                    icon: <HiPlus className="text-base text-blue-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      openNew();
                    },
                  },
                  {
                    label: t("Nhập Excel"),
                    hint: t(
                      "Excel: A username|B mail|C mailkp+cookie|D trống|E ngày|F mk|G spc_f|H domain (.vn/.ph)"
                    ),
                    icon: <HiUpload className="text-base text-cyan-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      excelInputRef.current?.click();
                    },
                  },
                  {
                    label: t("Nhập TXT"),
                    hint: t("TXT TAB: giống Excel — cột H domain (.vn/.ph)"),
                    icon: <RiFileTextLine className="text-base text-blue-600" />,
                    action: () => {
                      setAddMenuOpen(false);
                      txtInputRef.current?.click();
                    },
                  },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="flex gap-2.5 items-start px-3 py-2 w-full text-left transition-colors hover:bg-gray-50"
                    onClick={item.action}
                  >
                    <span className="mt-0.5 shrink-0">{item.icon}</span>
                    <span>
                      <span className="block text-xs font-medium text-gray-800">{item.label}</span>
                      <span className="block mt-0.5 text-[11px] text-gray-400">{item.hint}</span>
                    </span>
                  </button>
                ))}
              </div>
            </Popover>

<button
              type="button"
              onClick={() => void downloadSampleExcel()}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#fef9c3", borderColor: "#fbbf24", color: "#ca8a04" }}
              title={t("Mẫu Excel: có cột H domain (.vn/.ph/...)") as string}
            >
              <HiDownload className="text-base" />
              {t("Tải Excel mẫu")}
            </button>
            <button
              type="button"
              onClick={downloadSampleTxt}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border hover:opacity-90"
              style={{ backgroundColor: "#fff7ed", borderColor: "#fb923c", color: "#c2410c" }}
            >
              <HiDownload className="text-base" />
              {t("Tải TXT mẫu")}
            </button>
            <button
              type="button"
              onClick={() => void handleOpenBatchCreateDialog()}
              disabled={!users.length || batchCreating}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-white rounded-lg shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: batchCreating ? "#059669" : "#047857" }}
              title={
                t(
                  "Mở dialog chọn nhóm → tạo Profile GPM Login cho tài khoản đã chọn"
                ) as string
              }
            >
              <HiDesktopComputer className="text-base" />
              {batchCreating && batchProgress
                ? `${t("Đang tạo…") as string} ${batchProgress.done}/${batchProgress.total}`
                : `${t("Tạo Profile tự động") as string}${
                    selectedIds.size > 0 ? ` (${selectedIds.size})` : ""
                  }`}
            </button>
            <button
              type="button"
              onClick={handleSyncProxies}
              disabled={!users.length || !proxies.length || batchCreating}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-white rounded-lg shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              style={
                !users.length || !proxies.length
                  ? { backgroundColor: "#a78bfa" }
                  : { backgroundColor: "#7c3aed" }
              }
              title={t("Gán mỗi tài khoản 1 proxy duy nhất từ tab Quản lý Proxy") as string}
            >
              <HiRefresh className="text-base" />
              {t("Đồng bộ Proxy")}
              {proxies.length > 0 ? ` (${proxies.length})` : ""}
            </button>
            <button
              type="button"
              onClick={handleDeleteAll}
              disabled={!selectedIds.size}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold text-white rounded-lg shadow-sm disabled:cursor-not-allowed disabled:opacity-40"
              style={{ backgroundColor: "#e11d48" }}
              title={t("Xóa các tài khoản đang được chọn (check)") as string}
            >
              <HiOutlineTrash className="text-base" />
              {t("Xóa đã chọn")}
              {selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-gray-500">
          {t("Tài khoản thô")}: Username · Domain · mail · mailkp · cookie · mk · spc_f · proxy
          {" · "}
          {t("Tạo Profile tự động")}: {t("chỉ tài khoản đã check + chưa có profile GPM")}
          {" · "}
          {t("TXT/Excel")}:{" "}
          <code className="px-1.5 py-0.5 bg-gray-100 rounded">
            Username|mail|mailkp|cookie|ngay|mk|spc_f|domain
          </code>
        </p>
      </div>

      <PanelListCard>
        {users.length === 0 ? (
          <div className={panelListClasses.empty}>{t("Chưa có người dùng")}</div>
        ) : (
          <>
            <PanelListToolbar
              trailing={
                <PanelListMatchCount
                  term={normalizedTerm}
                  matched={filteredUsers.length}
                  total={users.length}
                />
              }
            >
              <PanelListSearch
                value={searchQuery}
                onChange={setSearchQuery}
                placeholder={t("Tìm username / mail / mailkp / cookie / spc_f...") as string}
              />
            </PanelListToolbar>

            <div className="overflow-x-auto">
              <table className={panelListClasses.table} style={{ minWidth: 1200 }}>
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
                    <th className={`${panelListClasses.th} w-10 text-left`}>#</th>
                    <th className={`${panelListClasses.th} text-left`}>Username</th>
                    <th className={`${panelListClasses.th} text-left`}>Domain</th>
                    <th className={`${panelListClasses.th} text-left`}>mail</th>
                    <th className={`${panelListClasses.th} text-left`}>mailkp</th>
                    <th className={`${panelListClasses.th} text-left`}>cookie</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Mật khẩu")}</th>
                    <th className={`${panelListClasses.th} text-left`}>Cookie spc_f</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("ngày tạo")}</th>
                    <th className={`${panelListClasses.th} text-left`}>Proxy</th>
                    <th className={`${panelListClasses.th} text-center`}>{t("Kích hoạt")}</th>
                    <th className={`${panelListClasses.th} w-28 text-center`}>{t("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={13} className={panelListClasses.emptyMatch}>
                        {t("Không có người dùng nào khớp tìm kiếm.")}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user, index) => (
                      <tr
                        key={user.id}
                        className={panelListRowClass({ selected: selectedIds.has(user.id) })}
                        style={
                          user.active === false
                            ? { opacity: 0.55 }
                            : undefined
                        }
                      >
                        <td className={panelListClasses.td}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(user.id)}
                            onChange={(e) => toggleSelectOne(user.id, e.target.checked)}
                            className={panelListClasses.checkbox}
                          />
                        </td>
                        <td className={`${panelListClasses.td} font-mono text-xs text-gray-400`}>
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 font-semibold text-gray-900">{user.username}</td>
                        <td className="px-4 py-3 font-mono text-xs text-sky-700">
                          .{normalizeShopeeAccountDomain(user.domain)}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 200 }}>
                          <span className="inline-block max-w-full truncate text-xs text-gray-700">
                            {user.mail || user.email || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 200 }}>
                          <span className="inline-block max-w-full truncate font-mono text-xs text-gray-700">
                            {normalizeMailKp(user.mailKp) || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 280 }}>
                          <span className="inline-block px-2 py-1 max-w-full font-mono text-xs text-gray-700 truncate bg-gray-50 rounded border border-gray-200">
                            {user.cookie || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {user.password || "-"}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                          <span className="inline-block px-2 py-1 max-w-full font-mono text-xs text-gray-700 truncate bg-gray-50 rounded border border-gray-200">
                            {user.spcF || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {user.createdAt || "-"}
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-xs truncate text-pink"
                          style={{ maxWidth: 220 }}
                        >
                          {resolveUserProxy(user) || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <div
                            className="flex justify-center items-center"
                            title={
                              user.active !== false
                                ? (t("Đang kích hoạt — bấm để ngừng") as string)
                                : (t("Đã ngừng — bấm để kích hoạt") as string)
                            }
                          >
                            <Switch
                              size="sm"
                              dependent
                              value={user.active !== false}
                              onChange={(v) => toggleUserActive(user, Boolean(v))}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5 justify-center items-center">
                            <button
                              type="button"
                              onClick={() => openEdit(user)}
                              className="flex justify-center items-center w-8 h-8 text-blue-600 bg-blue-50 rounded-full border border-blue-200 shadow-sm hover:bg-blue-100"
                              title={t("Sửa")}
                            >
                              <HiPencil className="text-sm" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(user.id)}
                              className="flex justify-center items-center w-8 h-8 rounded-full border shadow-sm text-danger bg-danger-light border-danger hover:opacity-90"
                              title={t("Xóa")}
                            >
                              <HiOutlineTrash className="text-sm" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </PanelListCard>
            </div>
          </TabGroup.Tab>

          <TabGroup.Tab label={t("Quản lý Profile")}>
            <div className="p-4">
              <UsersProfilesPanel />
            </div>
          </TabGroup.Tab>
        </TabGroup>
      </div>

      <Dialog
        isOpen={batchDialogOpen}
        onClose={() => {
          if (!batchCreating && !creatingGroup) setBatchDialogOpen(false);
        }}
        title={t("Tạo Profile tự động")}
        icon={<HiDesktopComputer />}
        width="480px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
        extraHeaderClass="!z-0"
        extraBodyClass="relative z-20"
        onClick={(e) => e.stopPropagation()}
      >
        <Dialog.Body>
          <div
            className="pt-1 space-y-4"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="p-3 text-sm text-gray-700 bg-emerald-50 rounded-lg border border-emerald-100">
              <div>
                {t("Đã chọn")}: <strong>{selectedIds.size}</strong>
              </div>
              <div className="mt-1">
                {t("Sẽ tạo (đã chọn, chưa có profile GPM)")}: <strong>{batchTargetCount}</strong>
              </div>
              {batchSkipCreated > 0 ? (
                <div className="mt-1 text-xs text-gray-500">
                  {t("Bỏ qua (đã tạo)")}: {batchSkipCreated}
                </div>
              ) : null}
              {batchSkipMissing > 0 ? (
                <div className="mt-1 text-xs text-gray-500">
                  {t("Bỏ qua (thiếu dữ liệu)")}: {batchSkipMissing}
                </div>
              ) : null}
              {!selectedIds.size ? (
                <div className="mt-2 text-xs text-amber-700">
                  {t("Hãy chọn (check) ít nhất 1 tài khoản trước khi tạo Profile")}
                </div>
              ) : batchTargetCount === 0 ? (
                <div className="mt-2 text-xs text-amber-700">
                  {batchSkipCreated > 0 && batchSkipMissing === 0
                    ? t("Các tài khoản đã chọn đều đã có profile GPM")
                    : t(
                        "Trong các tài khoản đã chọn không còn tài khoản nào đủ dữ liệu để tạo profile"
                      )}
                </div>
              ) : null}
            </div>

            <div>
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Nhóm Profile")}
              </span>
              {batchGroupsLoading ? (
                <div className="text-sm text-gray-400">{t("Đang tải nhóm…")}</div>
              ) : batchGroups.length === 0 ? (
                <div className="text-sm text-amber-700">
                  {t("Chưa có nhóm — hãy tạo nhóm mới bên dưới")}
                </div>
              ) : (
                <div
                  className="overflow-y-auto relative z-30 max-h-48 rounded-lg border border-gray-200 divide-y divide-gray-100"
                  role="radiogroup"
                  aria-label={t("Nhóm Profile") as string}
                >
                  {batchGroups.map((g) => {
                    const selected = String(batchGroupId) === String(g.id);
                    return (
                      <label
                        key={g.id}
                        className={`flex gap-2 items-center px-3 py-2.5 w-full text-left cursor-pointer transition-colors select-none ${
                          selected ? "bg-emerald-50" : "bg-white hover:bg-gray-50"
                        }`}
                      >
                        <input
                          type="radio"
                          name="batch-gpm-group"
                          value={g.id}
                          checked={selected}
                          onChange={() => setBatchGroupId(String(g.id))}
                          className="w-4 h-4 text-emerald-600 border-gray-300 shrink-0 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-gray-800">{g.name}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Tạo nhóm Profile mới")}
              </span>
              <div className="flex gap-2">
                <input
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void handleCreateNewBatchGroup();
                    }
                  }}
                  placeholder={t("Tên nhóm mới…") as string}
                  className="flex-1 px-3 h-10 text-sm bg-white rounded border border-gray-300 outline-none focus:border-emerald-500"
                  disabled={creatingGroup}
                />
                <button
                  type="button"
                  onClick={() => void handleCreateNewBatchGroup()}
                  disabled={!newGroupName.trim() || creatingGroup}
                  className="inline-flex gap-1 items-center px-3 h-10 text-sm font-semibold text-white whitespace-nowrap rounded-lg disabled:opacity-50"
                  style={{ backgroundColor: "#047857" }}
                >
                  <HiPlus className="text-base" />
                  {creatingGroup ? t("Đang tạo…") : t("Tạo nhóm")}
                </button>
              </div>
              <p className="m-0 mt-2 text-xs text-gray-500">
                {t("Sau khi tạo, nhóm mới sẽ được chọn mặc định để gắn profile.")}
              </p>
            </div>

            <div className="flex gap-2 justify-end pt-1">
              <button
                type="button"
                onClick={() => setBatchDialogOpen(false)}
                disabled={batchCreating || creatingGroup}
                className="px-4 h-9 text-sm font-medium text-gray-700 bg-white rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                onClick={() => void handleCreateAllGpmProfiles(batchGroupId)}
                disabled={
                  !batchGroupId ||
                  !batchTargetCount ||
                  !selectedIds.size ||
                  batchGroupsLoading ||
                  batchCreating ||
                  creatingGroup
                }
                className="px-4 h-9 text-sm font-bold text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: "#047857" }}
              >
                {t("Bắt đầu tạo")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={!!editUser}
        onClose={() => setEditUser(null)}
        title={isNew ? t("Thêm Người Dùng") : t("Chỉnh Sửa Người Dùng")}
        icon={isNew ? <HiPlus /> : <HiPencil />}
        width="520px"
        maxWidth="95vw"
        slideFromBottom="mobile-only"
      >
        <Dialog.Body>
          <div className="pt-2 space-y-4">
            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Tên Người Dùng")}
              </span>
              <input
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">mail</span>
              <input
                value={form.mail}
                onChange={(e) => setForm((f) => ({ ...f, mail: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">mailkp</span>
              <input
                value={form.mailKp}
                onChange={(e) => setForm((f) => ({ ...f, mailKp: e.target.value }))}
                placeholder="email|mat-khau-khoi-phuc"
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">cookie</span>
              <textarea
                value={form.cookie}
                onChange={(e) => setForm((f) => ({ ...f, cookie: e.target.value }))}
                rows={2}
                placeholder={t("Cookie import từ Excel/TXT") as string}
                className="px-3 py-2 w-full text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>


            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("ngày tạo")}
              </span>
              <input
                value={form.createdAt}
                onChange={(e) => setForm((f) => ({ ...f, createdAt: e.target.value }))}
                placeholder="2026-06-22 23:37:52"
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
            </label>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">{t("Mật khẩu")}</span>
                <input
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>

              <label className="block">
                <span className="block mb-1.5 text-sm font-medium text-gray-700">Cookie spc_f</span>
                <input
                  value={form.spcF}
                  onChange={(e) => setForm((f) => ({ ...f, spcF: e.target.value }))}
                  className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
                />
              </label>
            </div>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">Domain</span>
              <select
                value={normalizeShopeeAccountDomain(form.domain)}
                onChange={(e) => setForm((f) => ({ ...f, domain: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              >
                {SHOPEE_ACCOUNT_DOMAINS.map((d) => (
                  <option key={d.code} value={d.code}>
                    {d.label}
                  </option>
                ))}
              </select>

            </label>

            <label className="block">
              <span className="block mb-1.5 text-sm font-medium text-gray-700">
                {t("Proxy (tùy chọn)")}
              </span>
              <input
                value={form.proxy}
                onChange={(e) => setForm((f) => ({ ...f, proxy: e.target.value }))}
                className="px-3 w-full h-10 text-sm rounded border border-gray-300 outline-none focus:border-blue-400"
              />
              <span className="block mt-1 text-xs text-gray-500">
                {t("Để trống nếu không dùng proxy — hoặc dùng nút Đồng bộ Proxy")}
              </span>
            </label>
          </div>
          <div className="flex gap-2 justify-end w-full">
            <button
              type="button"
              onClick={() => setEditUser(null)}
              className="px-4 h-9 text-sm font-bold text-white bg-gray-600 rounded-lg hover:bg-gray-700"
            >
              {t("Đóng")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 h-9 text-sm font-bold text-white rounded-lg bg-primary hover:bg-primary-dark"
            >
              {t("Lưu")}
            </button>
          </div>
        </Dialog.Body>
      </Dialog>

    </div>
  );
}