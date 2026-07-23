import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiClock,
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
import {
  clearCookieFetchHistory,
  cookieFetchActionLabel,
  cookieFetchActionTone,
  CookieFetchHistoryEntry,
  loadCookieFetchHistory,
} from "../cookie-fetch-history";
import { downloadCsvText } from "../scrape/api";
import {
  PanelListCard,
  PanelListMatchCount,
  PanelListSearch,
  PanelListToolbar,
  panelListClasses,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusProxy, AffiliatePlusUser, extractSpcFFromCookie, filterShopeeCookieAppString, formatCookieRemaining, formatMaybeExcelDate, getCookieLifeColor, getCookieRemainingMs, normalizeMailKp, normalizeShopeeAccountDomain, parseBacVietTheoExcelColumns, parseCompoundMailKpCookie, parseUserImportLine, resolveUserProxy, SHOPEE_ACCOUNT_DOMAINS } from "../types";

interface UsersPanelProps {
  users: AffiliatePlusUser[];
  proxies: AffiliatePlusProxy[];
  onUpdateUsers: (users: AffiliatePlusUser[]) => void;
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
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyFilterUserId, setHistoryFilterUserId] = useState<string>("");
  const [historyEntries, setHistoryEntries] = useState<CookieFetchHistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchQuery.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Tick mỗi 30s để đếm ngược hạn cookie 6 ngày đổi màu
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  const refreshCookieHistory = async (filterUserId?: string) => {
    setHistoryLoading(true);
    try {
      const list = await loadCookieFetchHistory();
      const uid = filterUserId === undefined ? historyFilterUserId : filterUserId;
      setHistoryEntries(uid ? list.filter((e) => e.userId === uid) : list);
    } catch {
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openCookieHistory = (userId = "") => {
    setHistoryFilterUserId(userId);
    setHistoryOpen(true);
    void refreshCookieHistory(userId);
  };

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.active !== false).length;
    const inactive = total - active;
    const error = users.filter((u) => Boolean(String(u.error || "").trim())).length;
    const withProxy = users.filter((u) => Boolean(resolveUserProxy(u))).length;
    return { total, active, inactive, error, withProxy };
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
        user.cookieApp,
        user.password,
        user.spcF,
        resolveUserProxy(user),
        user.error,
        user.generateItems?.map((g) => g.productName).join(" "),
        user.generateItems?.map((g) => g.productId).join(" "),
        user.generateItems?.map((g) => g.caption).join(" "),
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
          cookieApp: filterShopeeCookieAppString(form.cookieApp),
          password: form.password.trim(),
          spcF:
            extractSpcFFromCookie(form.cookieApp) ||
            extractSpcFFromCookie(form.cookie) ||
            form.spcF.trim(),
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
                cookieApp: filterShopeeCookieAppString(form.cookieApp),
                password: form.password.trim(),
                spcF:
                  extractSpcFFromCookie(form.cookieApp) ||
                  extractSpcFFromCookie(form.cookie) ||
                  form.spcF.trim(),
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
          {
            label: t("Lỗi"),
            value: stats.error,
            bg: "#fff1f2",
            border: "#fb7185",
            text: "#e11d48",
            dot: "#f43f5e",
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
              onClick={() => openCookieHistory("")}
              className="inline-flex gap-1.5 items-center px-3 h-9 text-sm font-semibold rounded-lg border shadow-sm hover:opacity-90"
              style={{ backgroundColor: "#ecfeff", borderColor: "#22d3ee", color: "#0e7490" }}
              title={t("Xem lịch sử cookie (IndexedDB)") as string}
            >
              <HiClock className="text-base" />
              {t("Lịch sử cookie")}
            </button>

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
              onClick={handleSyncProxies}
              disabled={!users.length || !proxies.length}
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
          {t("TXT/Excel")}:{" "}
          <code className="px-1.5 py-0.5 bg-gray-100 rounded">
            A–G … | H domain (.vn/.ph)
          </code>
          {" · "}
          {t("TXT nên dùng TAB")} (export Excel → TXT){" · "}
          {t("hoặc")}:{" "}
          <code className="px-1.5 py-0.5 bg-gray-100 rounded">
            Username|mail|mailkp|cookie|ngay|mk|spc_f|domain
          </code>
          {" · "}
          {t("Đồng bộ Proxy")}: 1 account ↔ 1 proxy (không trùng lắp)
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
              <table className={panelListClasses.table} style={{ minWidth: 1600 }}>
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
                    <th className={`${panelListClasses.th} text-left`}>Cookies App</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("ngày tạo")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Mật khẩu")}</th>
                    <th className={`${panelListClasses.th} text-left`}>Cookie spc_f</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Hạn cookie")}</th>
                    <th className={`${panelListClasses.th} text-left`}>{t("Item Generate")}</th>
                    <th className={`${panelListClasses.th} text-left`}>Proxy</th>
                    <th className={`${panelListClasses.th} text-center`}>Lỗi</th>
                    <th className={`${panelListClasses.th} text-center`}>{t("Kích hoạt")}</th>
                    <th className={`${panelListClasses.th} w-40 text-center`}>{t("Thao tác")}</th>
                  </tr>
                </thead>
                <tbody className={panelListClasses.tbody}>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={17} className={panelListClasses.emptyMatch}>
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
                        <td className="px-4 py-3" style={{ maxWidth: 280 }}>
                          <span
                            className="inline-block px-2 py-1 max-w-full font-mono text-xs truncate rounded border"
                            style={{
                              color: user.cookieApp ? "#0f766e" : "#9ca3af",
                              backgroundColor: user.cookieApp ? "#f0fdfa" : "#f9fafb",
                              borderColor: user.cookieApp ? "#99f6e4" : "#e5e7eb",
                            }}
                            title={user.cookieApp || undefined}
                          >
                            {user.cookieApp || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600 whitespace-nowrap">
                          {user.createdAt || "-"}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-gray-700">
                          {user.password || "-"}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                          <span className="inline-block px-2 py-1 max-w-full font-mono text-xs text-gray-700 truncate bg-gray-50 rounded border border-gray-200">
                            {user.spcF || "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {user.cookieFetchedAt ? (
                            (() => {
                              const remain = getCookieRemainingMs(user, nowTick);
                              return (
                                <span
                                  className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded border"
                                  style={{
                                    color: getCookieLifeColor(remain),
                                    borderColor: getCookieLifeColor(remain),
                                    backgroundColor: "rgba(255,255,255,0.9)",
                                  }}
                                  title={
                                    t("Còn hiệu lực kể từ lần lấy cookie (6 ngày)") as string
                                  }
                                >
                                  {formatCookieRemaining(remain)}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3" style={{ maxWidth: 200 }}>
                          {(user.generateItems?.length || 0) > 0 ? (
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-gray-800">
                                {t("{{count}} video/SP", {
                                  count: user.generateItems!.length,
                                })}
                              </div>
                              <div
                                className="text-gray-400 truncate text-10"
                                title={
                                  user
                                    .generateItems!.map(
                                      (g) => g.productName || g.productId || g.itemId
                                    )
                                    .filter(Boolean)
                                    .join(", ") || undefined
                                }
                              >
                                {user.generateItems![0].productName ||
                                  user.generateItems![0].productId ||
                                  "—"}
                                {user.generateItems!.length > 1
                                  ? ` +${user.generateItems!.length - 1}`
                                  : ""}
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">—</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-3 font-mono text-xs truncate text-pink"
                          style={{ maxWidth: 220 }}
                        >
                          {resolveUserProxy(user) || "-"}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-500">{user.error || "-"}</td>
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
                              onClick={() => openCookieHistory(user.id)}
                              className="flex justify-center items-center w-8 h-8 text-cyan-700 bg-cyan-50 rounded-full border border-cyan-200 shadow-sm hover:bg-cyan-100"
                              title={t("Lịch sử cookie của tài khoản") as string}
                            >
                              <HiClock className="text-sm" />
                            </button>

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
              <span className="block mb-1.5 text-sm font-medium text-gray-700">Cookies App</span>
              <textarea
                value={form.cookieApp}
                onChange={(e) => setForm((f) => ({ ...f, cookieApp: e.target.value }))}
                rows={3}
                placeholder={t("Cookie App — dán thủ công hoặc nhập từ Excel/TXT") as string}
                className="px-3 py-2 w-full text-sm rounded border border-teal-300 outline-none focus:border-teal-500 bg-teal-50/40"
              />
              <span className="block mt-1 text-xs text-gray-500">
                {t("Cookie dùng khi đăng video — chỉnh sửa thủ công nếu cần")}
              </span>
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

      <Dialog
        isOpen={historyOpen}
        onClose={() => setHistoryOpen(false)}
        title={t("Lịch sử lấy cookie") as string}
        width="920px"
        maxWidth="94vw"
      >
        <Dialog.Body>
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex flex-wrap gap-2 items-center">
                <label className="text-sm text-gray-600">{t("Tài khoản")}</label>
                <select
                  value={historyFilterUserId}
                  onChange={(e) => {
                    const uid = e.target.value;
                    setHistoryFilterUserId(uid);
                    void refreshCookieHistory(uid);
                  }}
                  className="h-9 min-w-[200px] rounded-lg border border-gray-300 px-2 text-sm outline-none focus:border-cyan-500"
                >
                  <option value="">{t("Tất cả tài khoản")}</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.username}
                      {u.domain ? ` (.${normalizeShopeeAccountDomain(u.domain)})` : ""}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => void refreshCookieHistory()}
                  className="inline-flex h-9 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  <HiRefresh className="text-base" />
                  {t("Tải lại")}
                </button>
              </div>
              <button
                type="button"
                onClick={async () => {
                  if (!window.confirm(String(t("Xóa toàn bộ lịch sử lấy cookie?")))) return;
                  await clearCookieFetchHistory();
                  setHistoryEntries([]);
                  toast.success(t("Đã xóa lịch sử cookie"));
                }}
                className="inline-flex h-9 items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 text-sm font-medium text-rose-700 hover:bg-rose-100"
              >
                <HiOutlineTrash className="text-base" />
                {t("Xóa lịch sử")}
              </button>
            </div>

            <div className="text-xs text-gray-500">
              {historyLoading
                ? t("Đang tải...")
                : t("{{count}} thao tác (lưu IndexedDB, tối đa 800)", {
                    count: historyEntries.length,
                  })}
            </div>

            <div className="overflow-auto max-h-[60vh] rounded-xl border border-gray-200">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-slate-50 text-left text-xs text-gray-600">
                  <tr>
                    <th className="px-3 py-2 font-semibold">{t("Thời gian")}</th>
                    <th className="px-3 py-2 font-semibold">Username</th>
                    <th className="px-3 py-2 font-semibold">Domain</th>
                    <th className="px-3 py-2 font-semibold">{t("Thao tác")}</th>
                    <th className="px-3 py-2 font-semibold">{t("Chi tiết")}</th>
                  </tr>
                </thead>
                <tbody>
                  {historyEntries.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-gray-400">
                        {historyLoading
                          ? t("Đang tải...")
                          : t("Chưa có lịch sử cookie")}
                      </td>
                    </tr>
                  ) : (
                    historyEntries.map((entry) => {
                      const tone = cookieFetchActionTone(entry.action);
                      const toneClass =
                        tone === "ok"
                          ? "text-emerald-700 bg-emerald-50 border-emerald-200"
                          : tone === "warn"
                            ? "text-amber-700 bg-amber-50 border-amber-200"
                            : tone === "error"
                              ? "text-rose-700 bg-rose-50 border-rose-200"
                              : "text-sky-700 bg-sky-50 border-sky-200";
                      const when = new Date(entry.createdAt);
                      return (
                        <tr key={entry.id} className="border-t border-gray-100 align-top">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-gray-600">
                            {when.toLocaleDateString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "2-digit",
                            })}{" "}
                            {when.toLocaleTimeString("vi-VN", {
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit",
                            })}
                          </td>
                          <td className="px-3 py-2 font-medium text-gray-900">
                            {entry.username || "—"}
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-sky-700">
                            {entry.domain ? `.${entry.domain}` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 text-xs font-semibold ${toneClass}`}
                            >
                              {cookieFetchActionLabel(entry.action)}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs text-gray-700">
                            <div>{entry.message || "—"}</div>
                            {entry.spcFPreview ? (
                              <div className="mt-1 font-mono text-[11px] text-gray-500 truncate max-w-[360px]">
                                SPC_F: {entry.spcFPreview}
                              </div>
                            ) : null}
                            {entry.cookiePreview ? (
                              <div className="mt-0.5 font-mono text-[11px] text-gray-400 truncate max-w-[360px]">
                                cookie: {entry.cookiePreview}
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
