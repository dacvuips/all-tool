import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiChevronDown,
  HiChevronLeft,
  HiChevronRight,
  HiChevronUp,
  HiDownload,
  HiEye,
  HiOutlineFilter,
  HiOutlineSearch,
  HiOutlineTrash,
  HiPlay,
} from "react-icons/hi";
import { RiChromeLine, RiDatabase2Line, RiLoader4Line, RiRefreshLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import {
  formatDuration,
  formatSessionTime,
  nextCrawlProjectName,
  saveScrapeCsvSession,
  ScrapeCsvSession,
  sessionDisplayName,
} from "../scrape-csv-history";
import {
  downloadCsvText,
  exportShopeeAffiliateCsv,
  fetchGemLoginProfiles,
  fetchGemLoginStatus,
  GemLoginProfileOption,
  loadScrapeCsvSessions,
  openShopeeAffiliateBrowser,
  probeScrapeAgent,
  removeAllScrapeCsvSessions,
  removeScrapeCsvSession,
  SCRAPE_AGENT_BASE,
  shortenAffiliateLinks,
} from "../scrape/api";
import {
  fetchAffiliateProductPage,
  mapRawToScrapeRow,
  probeCdpBridge,
} from "../scrape/product-page-fetch";
import {
  PanelListCard,
  panelListClasses,
  PanelListPagination,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusItem } from "../types";

const MARKET_OPTIONS = [
  { value: "affiliate.shopee.vn", label: "VN" },
  { value: "affiliate.shopee.ph", label: "PH" },
  { value: "affiliate.shopee.sg", label: "SG" },
  { value: "affiliate.shopee.co.th", label: "TH" },
  { value: "affiliate.shopee.com.my", label: "MY" },
  { value: "affiliate.shopee.co.id", label: "ID" },
];

const SCRAPE_AGENT_ZIP_WIN_URL = "/downloads/ShopeeScrapeAgent-windows.zip";
const SCRAPE_AGENT_ZIP_WIN_NAME = "ShopeeScrapeAgent-windows.zip";
const SCRAPE_AGENT_ZIP_MAC_URL = "/downloads/ShopeeScrapeAgent-macos.zip";
const SCRAPE_AGENT_ZIP_MAC_NAME = "ShopeeScrapeAgent-macos.zip";
/** Legacy link (Windows) — giữ file public cũ */
const GEMLOGIN_DOWNLOAD_URL = "https://app.gemlogin.vn/download-auth";

const SCRAPE_OPENAI_KEY_LS = "video-affiliate-plus-scrape-openai-key";
const SCRAPE_GEMINI_KEY_LS = "video-affiliate-plus-scrape-gemini-key";

function readScrapeAiKey(storageKey: string): string {
  if (typeof window === "undefined") return "";
  try {
    return String(localStorage.getItem(storageKey) || "");
  } catch {
    return "";
  }
}

function writeScrapeAiKey(storageKey: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    if (value) localStorage.setItem(storageKey, value);
    else localStorage.removeItem(storageKey);
  } catch {
    /* ignore quota */
  }
}

const GUIDE_STEPS = [
  {
    step: "01",
    titleKey: "Tải & chạy Agent",
    descKey:
      "Tải zip Windows hoặc Mac → giải nén → chạy BatDau.bat / BatDau.command. Giữ cửa sổ mở.",
    Icon: RiDatabase2Line,
  },
  {
    step: "02",
    titleKey: "Mở GemLogin Desktop",
    descKey: "Cài và mở GemLogin → Tạo profile mới → Profile đã đăng nhập Shopee Affiliate.",
    Icon: RiChromeLine,
  },
  {
    step: "03",
    titleKey: "Mở trình duyệt & cào",
    descKey: "Mở Trình duyệt → nhập từ khóa → nhập thông tin cần lọc → Bắt đầu cào hoặc Xuất CSV.",
    Icon: HiOutlineSearch,
  },
  {
    step: "04",
    titleKey: "Lọc & tải CSV",
    descKey: "Lọc Domain / Ngày / Tháng / Năm bên dưới, tải file CSV đã lưu về máy.",
    Icon: HiOutlineFilter,
  },
];

/** sort_type trên /api/v3/offer/product/list */
const SORT_TABS = [
  { value: 1, label: "Liên quan" },
  { value: 5, label: "Hoa hồng (%)" },
  { value: 2, label: "Bán chạy" },
] as const;

const PRICE_SORT_OPTIONS = [
  { value: 4, label: "Giá thấp → cao" },
  { value: 3, label: "Giá cao → thấp" },
] as const;

/** filter_shop_types trên product/list — chọn nhiều */
const SHOP_TYPE_TABS = [
  { value: 1, label: "Shopee Mall" },
  { value: 4, label: "Yêu Thích+" },
  { value: 2, label: "Yêu Thích" },
] as const;

export type ScrapeProductRow = {
  id: string;
  productName: string;
  /** Hoa hồng % */
  commissionPct: number;
  sales: number;
  price: number;
  commissionReceived: number;
  /** timestamp ms */
  postedAt: number;
  /** Bản ghi đầy đủ từ API — chỉ dùng khi xuất CSV */
  raw?: Record<string, unknown>;
};

/** Dòng bảng tab Crawl Giỏ Video (khớp PeeCrawl). */
export type GioVideoRow = {
  id: string;
  stt: number;
  /** Sản phẩm gốc */
  name: string;
  /** Số / text SP tương tự */
  similar: string;
  /** Quảng bá 7 ngày */
  promoted: string;
  /** Giỏ video */
  cartText: string;
  cartColor?: "ok" | "warn" | "muted";
  statusText: string;
  statusColor?: "ok" | "warn" | "muted" | "error" | "running";
};

/** Field sắp xếp SP tương tự — PeeCrawl tab2_data_sort.field */
const GIO_VIDEO_SORT_FIELDS = [
  { value: "hoa_hong", label: "Hoa Hồng" },
  { value: "tien_hoa_hong", label: "Tiền hoa hồng" },
  { value: "tong_da_ban", label: "Tổng đã bán" },
  { value: "ban_gan_day", label: "Bán gần đây" },
  { value: "ngay_dang", label: "Ngày đăng sản phẩm" },
] as const;

/** Hướng sắp xếp — PeeCrawl tab2_data_sort.direction */
const GIO_VIDEO_SORT_DIRECTIONS = [
  { value: "none", label: "Không sắp xếp" },
  { value: "desc", label: "Cao → thấp" },
  { value: "asc", label: "Thấp → cao" },
] as const;

type GioVideoSortField = (typeof GIO_VIDEO_SORT_FIELDS)[number]["value"];
type GioVideoSortDirection = (typeof GIO_VIDEO_SORT_DIRECTIONS)[number]["value"];
type GioVideoSortRow = { field: GioVideoSortField; direction: GioVideoSortDirection };

interface ScrapeDataPanelProps {
  onImportItems?: (fileName: string, items: AffiliatePlusItem[]) => void | Promise<void>;
}

function sessionLocalParts(ts: number) {
  const d = new Date(ts);
  return {
    year: d.getFullYear(),
    month: d.getMonth() + 1,
    day: d.getDate(),
  };
}

function formatVnd(value: number) {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}

function formatPostedDate(ts: number) {
  if (!ts) return "—";
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function serializeCsvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function escapeCsvValue(value: unknown): string {
  const text = serializeCsvCell(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Parse 1 dòng CSV (có quote). */
function parseCsvLineLocal(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/** CSV scrape (header = field gốc) → raw rows để hiện lại bảng SP. */
function parseScrapedCsvToRaws(csv: string): Record<string, unknown>[] {
  const text = String(csv || "")
    .replace(/^\uFEFF/, "")
    .trim();
  if (!text) return [];
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.length > 0);
  if (lines.length < 2) return [];
  const headers = parseCsvLineLocal(lines[0]);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = parseCsvLineLocal(lines[i]);
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      const key = String(h || "").trim();
      if (!key) return;
      obj[key] = vals[idx] ?? "";
    });
    rows.push(obj);
  }
  return rows;
}

/** CSV đầy đủ mọi field cào được — UI chỉ hiện cột gọn. */
function productsToFullScrapedCsv(rows: ScrapeProductRow[]): string {
  const raws = rows.map((r, idx) => {
    const base = { ...(r.raw || {}) } as Record<string, unknown>;
    if (base.stt == null) base.stt = idx + 1;
    if (!base.id && r.id) base.id = r.id;
    if (base.affiliate_link_short == null) base.affiliate_link_short = "";
    if (base.long_link == null) base.long_link = "";
    return base;
  });

  const preferred = [
    "stt",
    "item_id",
    "itemid",
    "shopid",
    "name",
    "shop_name",
    "seller_commission_rate",
    "default_commission_rate",
    "max_commission_rate",
    "long_link",
    "affiliate_link_short",
    "product_link",
    "image",
    "image_url",
    "price",
    "price_min",
    "price_max",
    "historical_sold",
    "sold",
    "ctime",
    "is_official_shop",
    "id",
  ];

  const seen = new Set<string>();
  for (const row of raws) {
    for (const key of Object.keys(row)) seen.add(key);
  }
  const keys = [
    ...preferred.filter((k) => seen.has(k)),
    ...Array.from(seen).filter((k) => !preferred.includes(k)),
  ];

  const lines = [keys.map((k) => escapeCsvValue(k)).join(",")];
  for (const row of raws) {
    lines.push(keys.map((k) => escapeCsvValue(row[k])).join(","));
  }
  return "\uFEFF" + lines.join("\n");
}

/** Tab Cào dữ liệu — GemLogin CDP + danh sách SP / CSV. */
export function ScrapeDataPanel(_props: ScrapeDataPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [sessions, setSessions] = useState<ScrapeCsvSession[]>([]);
  const [opening, setOpening] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  /** Market dùng khi Mở trình duyệt → /offer/product_offer */
  const [openMarketHost, setOpenMarketHost] = useState(MARKET_OPTIONS[0].value);
  const [gemProfiles, setGemProfiles] = useState<GemLoginProfileOption[]>([]);
  const [gemProfileId, setGemProfileId] = useState("");
  const [loadingGemProfiles, setLoadingGemProfiles] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [gemOnline, setGemOnline] = useState<boolean | null>(null);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [guideOpen, setGuideOpen] = useState(false);
  /** Uncontrolled — tránh IME tiếng Việt bị đúp dấu khi re-render. */
  const keywordsInputRef = useRef<HTMLInputElement>(null);
  const getKeywordsText = () => String(keywordsInputRef.current?.value || "");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveProjectName, setSaveProjectName] = useState("Crawl Project 1");
  const [savingProject, setSavingProject] = useState(false);
  /** sort_type API: 1 liên quan, 2 bán chạy, 3 giá↓, 4 giá↑, 5 hoa hồng */
  const [sortType, setSortType] = useState(1);
  /** filter_shop_types: 1=Mall, 4=Yêu thích+, 2=Yêu thích — multi-select */
  const [shopTypes, setShopTypes] = useState<number[]>([]);
  const [productLimit, setProductLimit] = useState(20);
  const [minCommissionPct, setMinCommissionPct] = useState(2);
  const [minSales, setMinSales] = useState(10);
  /** Đơn vị: nghìn đồng (k). Mặc định 0 = không lọc HH nhận về. */
  const [commissionReceivedK, setCommissionReceivedK] = useState(0);
  const [products, setProducts] = useState<ScrapeProductRow[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productPageSize, setProductPageSize] = useState(200);
  const [crawling, setCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState("");
  /** Tổng SP API đã quét (raw). */
  const [crawledCount, setCrawledCount] = useState(0);
  const crawlAbortRef = useRef(false);

  /** 0 = Crawl Project, 1 = Crawl Giỏ Video */
  const [scrapeSubTab, setScrapeSubTab] = useState(0);
  /** PeeCrawl: Song song (tab2_max_concurrent) */
  const [gioParallel, setGioParallel] = useState(1);
  /** PeeCrawl: Budget/profile (tab2_job_budget) */
  const [gioBudget, setGioBudget] = useState(100);
  /** PeeCrawl: 3 tiêu chí sắp xếp SP tương tự */
  const [gioSortRows, setGioSortRows] = useState<GioVideoSortRow[]>([
    { field: "hoa_hong", direction: "none" },
    { field: "hoa_hong", direction: "none" },
    { field: "hoa_hong", direction: "none" },
  ]);
  const [gioVideoRows, setGioVideoRows] = useState<GioVideoRow[]>([]);
  const [gioVideoPage, setGioVideoPage] = useState(1);
  const [gioVideoPageSize, setGioVideoPageSize] = useState(200);
  const [gioCrawling, setGioCrawling] = useState(false);
  const [gioCrawlStatus, setGioCrawlStatus] = useState("");
  const gioAbortRef = useRef(false);

  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false);
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [checkingOpenaiKey, setCheckingOpenaiKey] = useState(false);
  const [checkingGeminiKey, setCheckingGeminiKey] = useState(false);
  const [aiKeysDialogOpen, setAiKeysDialogOpen] = useState(false);

  const refreshLocal = async () => {
    setSessions(await loadScrapeCsvSessions());
  };

  const refreshAgentAndGem = async () => {
    setLoadingGemProfiles(true);
    try {
      const agent = await probeScrapeAgent(2500);
      setAgentOnline(agent.online);
      if (!agent.online) {
        setGemOnline(false);
        setGemProfiles([]);
        return;
      }
      const status = await fetchGemLoginStatus();
      setGemOnline(Boolean(status.online));
      if (!status.online) {
        setGemProfiles([]);
        return;
      }
      const list = await fetchGemLoginProfiles();
      setGemProfiles(list);
      setGemProfileId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id || "";
      });
    } catch {
      setAgentOnline(false);
      setGemOnline(false);
      setGemProfiles([]);
    } finally {
      setLoadingGemProfiles(false);
    }
  };

  useEffect(() => {
    void refreshLocal();
    void refreshAgentAndGem();
    setOpenaiKey(readScrapeAiKey(SCRAPE_OPENAI_KEY_LS));
    setGeminiKey(readScrapeAiKey(SCRAPE_GEMINI_KEY_LS));
  }, []);

  const persistOpenaiKey = (value: string) => {
    setOpenaiKey(value);
    writeScrapeAiKey(SCRAPE_OPENAI_KEY_LS, value.trim());
  };

  const persistGeminiKey = (value: string) => {
    setGeminiKey(value);
    writeScrapeAiKey(SCRAPE_GEMINI_KEY_LS, value.trim());
  };

  const handleCheckOpenaiKey = async () => {
    const key = openaiKey.trim();
    if (!key) {
      toast.warn(t("Vui lòng nhập OpenAI Key."));
      return;
    }
    setCheckingOpenaiKey(true);
    try {
      const resp = await fetch("https://api.openai.com/v1/models", {
        method: "GET",
        headers: { Authorization: `Bearer ${key}` },
      });
      if (resp.ok) {
        toast.success(t("✅ OpenAI Key hợp lệ!"));
        return;
      }
      const body = await resp.text().catch(() => "");
      toast.error(
        t("❌ OpenAI Key không hợp lệ ({{status}}): {{detail}}", {
          status: resp.status,
          detail: body.slice(0, 160) || resp.statusText,
        })
      );
    } catch (err: any) {
      // Browser thường bị CORS — vẫn lưu key; báo format gợi ý
      if (/^sk-/i.test(key)) {
        toast.warn(
          t("Không kiểm tra trực tiếp từ trình duyệt (CORS). Key dạng sk-… đã lưu.")
        );
      } else {
        toast.error(err?.message || t("Không kiểm tra được OpenAI Key"));
      }
    } finally {
      setCheckingOpenaiKey(false);
    }
  };

  const handleCheckGeminiKey = async () => {
    const key = geminiKey.trim();
    if (!key) {
      toast.warn(t("Vui lòng nhập Gemini Key."));
      return;
    }
    setCheckingGeminiKey(true);
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(
        key
      )}&pageSize=1`;
      const resp = await fetch(url, { method: "GET" });
      if (resp.ok) {
        toast.success(t("✅ Gemini Key hợp lệ!"));
        return;
      }
      const body = await resp.text().catch(() => "");
      toast.error(
        t("❌ Gemini Key không hợp lệ ({{status}}): {{detail}}", {
          status: resp.status,
          detail: body.slice(0, 160) || resp.statusText,
        })
      );
    } catch (err: any) {
      if (/^(AIza|AQ\.)/i.test(key)) {
        toast.warn(
          t("Không kiểm tra trực tiếp từ trình duyệt. Key dạng Gemini đã lưu.")
        );
      } else {
        toast.error(err?.message || t("Không kiểm tra được Gemini Key"));
      }
    } finally {
      setCheckingGeminiKey(false);
    }
  };

  const domainOptions = useMemo(() => {
    const fromData = new Set(sessions.map((s) => s.marketHost).filter(Boolean) as string[]);
    const known = MARKET_OPTIONS.map((m) => m.value);
    for (const h of known) fromData.add(h);
    return Array.from(fromData).sort();
  }, [sessions]);

  const yearOptions = useMemo(() => {
    const years = new Set(sessions.map((s) => sessionLocalParts(s.createdAt).year));
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDomain && s.marketHost !== filterDomain) return false;
      const { year, month, day } = sessionLocalParts(s.createdAt);
      if (filterYear && year !== Number(filterYear)) return false;
      if (filterMonth && month !== Number(filterMonth)) return false;
      if (filterDay && day !== Number(filterDay)) return false;
      return true;
    });
  }, [sessions, filterDomain, filterYear, filterMonth, filterDay]);

  const totalPages = Math.max(1, Math.ceil(filteredSessions.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pagedSessions = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredSessions.slice(start, start + pageSize);
  }, [filteredSessions, safePage, pageSize]);

  const productTotalPages = Math.max(1, Math.ceil(products.length / productPageSize));
  const safeProductPage = Math.min(productPage, productTotalPages);
  const pagedProducts = useMemo(() => {
    const start = (safeProductPage - 1) * productPageSize;
    return products.slice(start, start + productPageSize);
  }, [products, safeProductPage, productPageSize]);

  const gioCompletedCount = useMemo(
    () => gioVideoRows.filter((r) => /hoàn thành/i.test(r.statusText)).length,
    [gioVideoRows]
  );
  const gioVideoTotalPages = Math.max(1, Math.ceil(gioVideoRows.length / gioVideoPageSize));
  const safeGioVideoPage = Math.min(gioVideoPage, gioVideoTotalPages);
  const pagedGioVideoRows = useMemo(() => {
    const start = (safeGioVideoPage - 1) * gioVideoPageSize;
    return gioVideoRows.slice(start, start + gioVideoPageSize);
  }, [gioVideoRows, safeGioVideoPage, gioVideoPageSize]);

  useEffect(() => {
    setProductPage(1);
  }, [products.length]);

  useEffect(() => {
    setGioVideoPage(1);
  }, [gioVideoRows.length]);

  const updateGioSortRow = (
    index: number,
    patch: Partial<GioVideoSortRow>
  ) => {
    setGioSortRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row))
    );
  };

  const handleResetGioFilters = () => {
    setGioParallel(1);
    setGioBudget(100);
    setGioSortRows([
      { field: "hoa_hong", direction: "none" },
      { field: "hoa_hong", direction: "none" },
      { field: "hoa_hong", direction: "none" },
    ]);
    setGioCrawlStatus("");
  };

  const handleStartGioCrawl = () => {
    if (gioCrawling) {
      gioAbortRef.current = true;
      setGioCrawling(false);
      setGioCrawlStatus(t("Đã dừng"));
      return;
    }
    gioAbortRef.current = false;
    setGioCrawling(true);
    setGioCrawlStatus(
      t("Đã cấu hình (song song {{p}}, budget {{b}}) — chờ nối logic cào.", {
        p: gioParallel,
        b: gioBudget,
      })
    );
    // UI-only: chưa có backend giỏ video → không giữ trạng thái "đang cào".
    setGioCrawling(false);
  };

  const domainLabel = (host: string) => {
    const known = MARKET_OPTIONS.find((m) => m.value === host);
    return known ? `${known.label} — ${host}` : host;
  };

  const clearFilters = () => {
    setFilterDomain("");
    setFilterYear("");
    setFilterMonth("");
    setFilterDay("");
    setPage(1);
  };

  const handleOpenBrowser = async () => {
    const agent = await probeScrapeAgent(2500);
    setAgentOnline(agent.online);
    if (!agent.online) {
      toast.error(
        t("Chưa thấy Local Agent ({{url}}). Mở Shopee Scrape Agent (BatDau.bat / .exe).", {
          url: SCRAPE_AGENT_BASE,
        })
      );
      return;
    }
    if (!gemProfileId) {
      toast.warn(t("Chọn profile GemLogin trước. Bấm làm mới nếu danh sách trống."));
      void refreshAgentAndGem();
      return;
    }
    try {
      setOpening(true);
      const result = await openShopeeAffiliateBrowser({
        marketHost: openMarketHost,
        gemloginProfileId: gemProfileId,
      });
      toast.success(
        t("Đã mở GemLogin + capture session. Giữ cửa sổ mở rồi Bắt đầu cào.", {
          n: result.cookieCount ?? 0,
        })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được trình duyệt"));
      void refreshAgentAndGem();
    } finally {
      setOpening(false);
    }
  };

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    const keywordList = getKeywordsText()
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    const keyword = keywordList[0] || "";
    try {
      setExportingCsv(true);
      const bridgeOk = await probeCdpBridge();
      if (!bridgeOk) {
        const agent = await probeScrapeAgent(2000);
        toast.error(
          agent.online
            ? t("Chưa có cookie. Bấm «Mở Trình duyệt» (GemLogin) trước.")
            : t("Chưa thấy Local Agent. Mở Shopee Scrape Agent (BatDau.bat / .exe).")
        );
        return;
      }
      const session = await exportShopeeAffiliateCsv({
        marketHost: openMarketHost,
        keyword,
        sortType,
        maxProducts: Math.max(1, productLimit),
        delayMs: 400,
        listType: 0,
        filterShopTypes: orderedShopTypes(),
      });
      setSessions(await loadScrapeCsvSessions());
      toast.success(t("Đã xuất CSV: {{count}} SP", { count: session.productCount }));
    } catch (err: any) {
      toast.error(err?.message || t("Xuất CSV thất bại"));
    } finally {
      setExportingCsv(false);
    }
  };

  const handleDeleteOne = async (id: string) => {
    try {
      setSessions(await removeScrapeCsvSession(id));
      toast.warn(t("Đã xóa phiên CSV"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  const handleViewSession = (session: ScrapeCsvSession) => {
    try {
      const raws = parseScrapedCsvToRaws(session.csv);
      if (!raws.length) {
        toast.warn(t("File CSV trống hoặc không đọc được"));
        return;
      }
      const mapped: ScrapeProductRow[] = raws.map((raw, index) => {
        const row = mapRawToScrapeRow(raw, index);
        return { ...row, raw };
      });
      setProducts(mapped);
      setCrawledCount(mapped.length);
      setCrawlStatus("view");
      if (session.marketHost) setOpenMarketHost(session.marketHost);
      if (keywordsInputRef.current) {
        keywordsInputRef.current.value = session.keyword || "";
      }
      toast.success(
        t("Đã mở «{{name}}» · {{count}} SP", {
          name: sessionDisplayName(session),
          count: mapped.length,
        })
      );
      window.requestAnimationFrame(() => {
        document.getElementById("scrape-product-list")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được file CSV"));
    }
  };

  const handleDeleteAll = async () => {
    if (!sessions.length) return;
    if (!window.confirm(t("Xóa tất cả danh sách CSV trong IndexedDB?"))) return;
    try {
      await removeAllScrapeCsvSessions();
      setSessions([]);
      toast.warn(t("Đã xóa tất cả phiên CSV"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  const handleResetFilters = () => {
    if (keywordsInputRef.current) keywordsInputRef.current.value = "";
    setSortType(1);
    setShopTypes([]);
    setProductLimit(20);
    setMinCommissionPct(2);
    setMinSales(10);
    setCommissionReceivedK(0);
    setProducts([]);
    setCrawlStatus("");
    setCrawledCount(0);
    toast.info(t("Đã lọc lại bộ lọc mặc định"));
  };

  const orderedShopTypes = () =>
    SHOP_TYPE_TABS.map((t) => t.value).filter((v) => shopTypes.includes(v));

  const toggleShopType = (value: number) => {
    setShopTypes((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value]
    );
  };

  const passesFilters = (row: ReturnType<typeof mapRawToScrapeRow>) => {
    if (row.commissionPct < minCommissionPct) return false;
    if (row.sales < minSales) return false;
    if (commissionReceivedK > 0 && row.commissionReceived < commissionReceivedK * 1000) {
      return false;
    }
    return true;
  };

  const handleStartCrawl = async () => {
    if (crawling) {
      crawlAbortRef.current = true;
      setCrawlStatus(t("Đang dừng..."));
      return;
    }

    const keywordList = getKeywordsText()
      .split(/[,;\n]+/)
      .map((k) => k.trim())
      .filter(Boolean);
    // Không có từ khóa → cào list mặc định (không gửi param keyword)
    const crawlKeywords = keywordList.length ? keywordList : [""];
    if (productLimit < 1) {
      toast.warn(t("Số lượng SP cần lấy phải > 0"));
      return;
    }

    const bridgeOk = await probeCdpBridge();
    if (!bridgeOk) {
      const agent = await probeScrapeAgent(2000);
      toast.error(
        agent.online
          ? t(
              "Chưa có cookie. Bấm «Mở Trình duyệt» (GemLogin), đăng nhập Affiliate nếu cần, rồi thử lại."
            )
          : t("Chưa thấy Local Agent. Mở Shopee Scrape Agent (BatDau.bat / .exe).")
      );
      return;
    }

    crawlAbortRef.current = false;
    setCrawling(true);
    setProducts([]);
    setCrawledCount(0);

    const accepted: ScrapeProductRow[] = [];
    const seen = new Set<string>();
    const pageLimit = 20;
    const delayMs = 450;
    const maxPagesPerKeyword = 250;
    let scannedRaw = 0;

    try {
      for (const keyword of crawlKeywords) {
        if (crawlAbortRef.current || accepted.length >= productLimit) break;
        let pageOffset = 0;
        let pageNo = 0;
        const keywordLabel = keyword || t("(không từ khóa)");

        // Cào tiếp từng trang cho tới khi đủ số lượng hoặc hết data API
        while (
          !crawlAbortRef.current &&
          accepted.length < productLimit &&
          pageNo < maxPagesPerKeyword
        ) {
          pageNo += 1;
          setCrawlStatus(
            t(
              'Đang cào "{{keyword}}" · trang {{page}} · đã cào {{scanned}} · khớp {{count}}/{{limit}}',
              {
                keyword: keywordLabel,
                page: pageNo,
                scanned: scannedRaw,
                count: accepted.length,
                limit: productLimit,
              }
            )
          );

          const page = await fetchAffiliateProductPage({
            marketHost: openMarketHost,
            keyword,
            sortType,
            pageOffset,
            pageLimit,
            listType: 0,
            filterShopTypes: orderedShopTypes(),
          });

          if (!page.products.length) break;

          scannedRaw += page.products.length;
          setCrawledCount(scannedRaw);

          for (const raw of page.products) {
            if (accepted.length >= productLimit) break;
            const mapped = mapRawToScrapeRow(raw, accepted.length);
            if (!mapped.id || seen.has(mapped.id)) continue;
            if (!passesFilters(mapped)) continue;
            seen.add(mapped.id);
            accepted.push({
              id: mapped.id,
              productName: mapped.productName,
              commissionPct: mapped.commissionPct,
              sales: mapped.sales,
              price: mapped.price,
              commissionReceived: mapped.commissionReceived,
              postedAt: mapped.postedAt,
              raw: raw as Record<string, unknown>,
            });
            setProducts([...accepted]);
          }

          setCrawlStatus(
            t(
              'Đang cào "{{keyword}}" · trang {{page}} · đã cào {{scanned}} · khớp {{count}}/{{limit}}',
              {
                keyword: keywordLabel,
                page: pageNo,
                scanned: scannedRaw,
                count: accepted.length,
                limit: productLimit,
              }
            )
          );

          if (accepted.length >= productLimit) break;
          if (!page.hasMore) break;
          pageOffset += pageLimit;
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }

      setCrawledCount(scannedRaw);
      const doneMsg = crawlAbortRef.current
        ? t("Đã dừng · đã cào {{scanned}} · khớp {{count}}/{{limit}}", {
            count: accepted.length,
            limit: productLimit,
            scanned: scannedRaw,
          })
        : accepted.length >= productLimit
        ? t("Hoàn tất · đã cào {{scanned}} · khớp {{count}}", {
            count: accepted.length,
            scanned: scannedRaw,
          })
        : t("Hết data API · đã cào {{scanned}} · khớp {{count}}/{{limit}}", {
            count: accepted.length,
            limit: productLimit,
            scanned: scannedRaw,
          });
      setCrawlStatus(doneMsg);
      toast.success(
        t("Cào xong: đã cào {{scanned}} · khớp {{count}}", {
          count: accepted.length,
          scanned: scannedRaw,
        })
      );
    } catch (err: any) {
      setCrawlStatus("");
      toast.error(err?.message || t("Cào thất bại"));
    } finally {
      setCrawling(false);
      crawlAbortRef.current = false;
    }
  };

  const openSaveProjectDialog = () => {
    if (!products.length) {
      toast.warn(t("Chưa có sản phẩm để lưu"));
      return;
    }
    setSaveProjectName(nextCrawlProjectName(sessions));
    setSaveDialogOpen(true);
  };

  const handleSaveProject = async () => {
    if (!products.length) {
      toast.warn(t("Chưa có sản phẩm để lưu"));
      return;
    }
    const name = saveProjectName.trim() || nextCrawlProjectName(sessions);
    try {
      setSavingProject(true);

      // long_link → affiliate_link_short trước khi ghi CSV
      const linkRows = products
        .map((p, index) => ({
          index,
          link: String(
            (p.raw as any)?.long_link ||
              (p.raw as any)?.affiliate_link ||
              (p.raw as any)?.product_link ||
              ""
          ).trim(),
        }))
        .filter((r) => !!r.link);

      let productsWithShort = products.map((p) => ({
        ...p,
        raw: {
          ...(p.raw || {}),
          affiliate_link_short: String((p.raw as any)?.affiliate_link_short || ""),
        },
      }));

      if (linkRows.length) {
        const bridgeOk = await probeCdpBridge();
        if (!bridgeOk) {
          throw new Error(
            t(
              "Chưa có cookie. Bấm «Mở Trình duyệt» trước khi lưu (cần để tạo short link)."
            ) as string
          );
        }
        toast.info(t("Đang tạo short link {{count}} SP…", { count: linkRows.length }) as string);
        const shorts = await shortenAffiliateLinks(
          linkRows.map((r) => r.link),
          400
        );
        const filled = shorts.filter(Boolean).length;
        if (filled === 0) {
          throw new Error(
            t(
              "Không tạo được short link. Giữ GemLogin mở (đã login Affiliate) rồi thử Lưu lại. Xem cửa sổ Agent để biết chi tiết."
            ) as string
          );
        }
        productsWithShort = productsWithShort.map((p) => ({ ...p, raw: { ...p.raw } }));
        linkRows.forEach((row, i) => {
          const raw = productsWithShort[row.index].raw as Record<string, unknown>;
          raw.affiliate_link_short = shorts[i] || "";
        });
        setProducts(productsWithShort);
        if (filled < linkRows.length) {
          toast.warn(
            t("Chỉ tạo được {{ok}}/{{total}} short link", {
              ok: filled,
              total: linkRows.length,
            }) as string
          );
        }
      }

      const csv = productsToFullScrapedCsv(productsWithShort);
      const keywordsText = getKeywordsText().trim();

      await saveScrapeCsvSession({
        name,
        keyword: keywordsText || name,
        marketHost: openMarketHost,
        marketCode: "",
        productCount: productsWithShort.length,
        csv,
        durationMs: 0,
      });
      setSessions(await loadScrapeCsvSessions());
      setSaveDialogOpen(false);
      toast.success(
        t("Đã lưu «{{name}}» · {{count}} SP", { name, count: productsWithShort.length })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Lưu project thất bại"));
    } finally {
      setSavingProject(false);
    }
  };

  const isPriceSort = sortType === 3 || sortType === 4;
  const priceSortLabel = PRICE_SORT_OPTIONS.find((o) => o.value === sortType)?.label || t("Giá");

  const selectClass =
    "h-8 min-w-28 text-xs rounded-lg border border-gray-200 bg-white px-2 disabled:opacity-50";
  const fieldLabelClass = "m-0 mb-1.5 block text-sm font-semibold text-gray-800";
  const fieldInputClass =
    "h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition-colors focus:border-teal-400";
  const splitRowClass = "flex overflow-hidden rounded-lg border border-gray-300";
  const splitLabelClass =
    "flex min-w-0 flex-1 items-center bg-gray-50 px-3 text-sm font-medium text-gray-700";
  const splitInputWrapClass =
    "flex w-32 shrink-0 items-center gap-1 border-l border-gray-300 bg-white px-2";
  const splitInputClass =
    "h-10 w-full min-w-0 border-0 bg-transparent text-sm text-gray-800 outline-none";
  const sortTabBase =
    "inline-flex h-9 items-center justify-center px-2 text-xs font-semibold border-r border-gray-300 last:border-r-0 transition-colors";
  const sortTabIdle = "bg-white text-gray-700 hover:bg-gray-50";
  const sortTabActive =
    "relative z-10 bg-orange-light text-orange-dark ring-2 ring-inset ring-none ring-orange-light";

  const crawlProjectForm = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-3">
        <div>
          <label className={fieldLabelClass} htmlFor="scrape-keywords">
            {t("Từ khóa sản phẩm")}
          </label>
          <input
            id="scrape-keywords"
            ref={keywordsInputRef}
            type="text"
            defaultValue=""
            autoComplete="off"
            spellCheck={false}
            lang="vi"
            placeholder={t("Để trống = cào all · hoặc: túi xách, giày")}
            className={fieldInputClass}
          />
        </div>

        <div>
          <label className={fieldLabelClass}>{t("Sắp xếp theo")}</label>
          <div className="inline-flex w-full overflow-hidden rounded-lg border border-gray-300 bg-white">
            {SORT_TABS.map((tab) => {
              const active = sortType === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  disabled={crawling}
                  aria-pressed={active}
                  onClick={() => setSortType(tab.value)}
                  className={`${sortTabBase} flex-1 whitespace-nowrap ${
                    active ? sortTabActive : sortTabIdle
                  } disabled:opacity-50`}
                >
                  {t(tab.label)}
                </button>
              );
            })}
            <label
              className={`${sortTabBase} relative flex-1 cursor-pointer ${
                isPriceSort ? sortTabActive : sortTabIdle
              } ${crawling ? "opacity-50 pointer-events-none" : ""}`}
            >
              <span
                className={`inline-flex items-center gap-1 pointer-events-none ${
                  isPriceSort ? "text-orange-dark" : "text-gray-700"
                }`}
              >
                {isPriceSort ? t(priceSortLabel) : t("Giá")}
                <HiChevronDown className="text-sm" />
              </span>
              <select
                aria-label={t("Sắp xếp theo giá")}
                disabled={crawling}
                value={isPriceSort ? String(sortType) : ""}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v === 3 || v === 4) setSortType(v);
                }}
                className="absolute inset-0 cursor-pointer opacity-0"
              >
                <option value="" disabled>
                  {t("Giá")}
                </option>
                {PRICE_SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(opt.label)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div>
          <label className={fieldLabelClass}>{t("Loại shop")}</label>
          <div className="inline-flex w-full overflow-hidden rounded-lg border border-gray-300 bg-white">
            {SHOP_TYPE_TABS.map((tab) => {
              const active = shopTypes.includes(tab.value);
              return (
                <button
                  key={tab.value}
                  type="button"
                  disabled={crawling}
                  aria-pressed={active}
                  onClick={() => toggleShopType(tab.value)}
                  className={`${sortTabBase} flex-1 whitespace-nowrap ${
                    active ? sortTabActive : sortTabIdle
                  } disabled:opacity-50`}
                >
                  {t(tab.label)}
                </button>
              );
            })}
          </div>
        </div>

        <div>
          <label className={fieldLabelClass} htmlFor="scrape-product-limit">
            {t("Số lượng SP cần lấy")}
          </label>
          <input
            id="scrape-product-limit"
            type="number"
            min={1}
            value={productLimit}
            onChange={(e) => setProductLimit(Number(e.target.value) || 0)}
            className={fieldInputClass}
          />
        </div>

        <div className={splitRowClass}>
          <div className={splitLabelClass}>{t("Hoa hồng tối thiểu")}</div>
          <div className={splitInputWrapClass}>
            <input
              type="number"
              min={0}
              value={minCommissionPct}
              onChange={(e) => setMinCommissionPct(Number(e.target.value) || 0)}
              className={splitInputClass}
              aria-label={t("Hoa hồng tối thiểu")}
            />
            <span className="shrink-0 text-sm text-gray-500">%</span>
          </div>
        </div>

        <div className={splitRowClass}>
          <div className={splitLabelClass}>{t("Lượt bán tối thiểu")}</div>
          <div className={splitInputWrapClass}>
            <input
              type="number"
              min={0}
              value={minSales}
              onChange={(e) => setMinSales(Number(e.target.value) || 0)}
              className={splitInputClass}
              aria-label={t("Lượt bán tối thiểu")}
            />
          </div>
        </div>

        <div className={splitRowClass}>
          <div className={splitLabelClass}>{t("Hoa hồng nhận về")}</div>
          <div className={splitInputWrapClass}>
            <input
              type="number"
              min={0}
              value={commissionReceivedK}
              onChange={(e) => setCommissionReceivedK(Number(e.target.value) || 0)}
              className={splitInputClass}
              aria-label={t("Hoa hồng nhận về")}
            />
            <span className="shrink-0 text-sm text-gray-500">k</span>
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 pt-3 border-t border-gray-100">
        {crawlStatus ? (
          <p className="m-0 text-10 leading-relaxed text-gray-500">{crawlStatus}</p>
        ) : null}
        <div className="flex flex-nowrap gap-2">
          <button
            type="button"
            disabled={crawling}
            onClick={handleResetFilters}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-gray-200 px-2 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-50"
          >
            {t("Lọc lại")}
          </button>
          <button
            type="button"
            onClick={() => void handleStartCrawl()}
            className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-2 text-xs font-bold text-white transition-colors ${
              crawling
                ? "border-rose-600 bg-rose-600 hover:bg-rose-700"
                : "border-blue-600 bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {crawling ? (
              <>
                <RiLoader4Line className="mr-1 animate-spin" />
                {t("Dừng")}
              </>
            ) : (
              t("Bắt đầu cào")
            )}
          </button>
          <button
            type="button"
            disabled={crawling || !products.length}
            onClick={openSaveProjectDialog}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-green-600 bg-green-600 px-2 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {t("Lưu project")}
          </button>
        </div>
      </div>
    </div>
  );

  const productListPanel = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gray-100 px-3 py-2.5 sm:grid-cols-3">
        <div className="flex flex-row items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-blue-600">
            {t("Đã cào")}
          </p>
          <p className="m-0 text-lg font-bold tabular-nums text-blue-800">{crawledCount}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2 rounded-lg border border-pink-300 bg-pink-100 px-3 py-2">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-pink-700">
            {t("Khớp lọc")}
          </p>
          <p className="m-0 text-lg font-bold tabular-nums text-pink-900">
            {products.length}
            <span className="ml-1 text-xs font-semibold text-pink-600">/ {productLimit}</span>
          </p>
        </div>
        <div className="col-span-2 flex flex-row items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 sm:col-span-1">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-purple-600">
            {t("Trạng thái")}
          </p>
          <p className="m-0 truncate text-sm font-semibold text-purple-800">
            {crawling ? t("Đang cào...") : crawlStatus ? t("Hoàn tất") : t("Chưa chạy")}
          </p>
        </div>
      </div>

      <div
        id="scrape-product-list"
        className="flex shrink-0 flex-wrap gap-2 justify-between items-center px-4 py-2 border-b border-gray-100"
      >
        <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          {t("Danh sách sản phẩm")}
        </p>
        <span className="text-xs text-gray-400">
          {t("Đã cào")}: <b className="text-gray-700">{crawledCount}</b>
          <span className="mx-1 text-gray-300">·</span>
          {t("Khớp")}: <b className="text-teal-700">{products.length}</b>
        </span>
      </div>

      {!products.length ? (
        <div className={`flex-1 ${panelListClasses.empty}`}>
          {t("Chưa có sản phẩm. Cấu hình filter rồi chạy crawl.")}
        </div>
      ) : (
        <>
          {/* Viewport ~10 dòng; trang lớn hơn thì scroll trong khung (không dùng arbitrary [] — Tailwind cũ) */}
          <div
            className="min-h-0 overflow-x-auto overflow-y-auto"
            style={{ maxHeight: "calc(2.75rem + 10 * 2.75rem)" }}
          >
            <table className={panelListClasses.table}>
              <thead className="sticky top-0 z-10">
                <tr className="text-xs font-semibold text-gray-700 bg-bluegray-100 border-b border-gray-200">
                  <th className={`${panelListClasses.th} text-center w-14`}>{t("STT")}</th>
                  <th className={`${panelListClasses.th} text-left max-w-xs`}>
                    {t("Sản phẩm gốc")}
                  </th>
                  <th className={`${panelListClasses.th} text-center`}>{t("HH")}</th>
                  <th className={`${panelListClasses.th} text-center`}>{t("Lượt Bán")}</th>
                  <th className={`${panelListClasses.th} text-right`}>{t("Giá")}</th>
                  <th className={`${panelListClasses.th} text-right`}>{t("HH nhận về")}</th>
                  <th className={`${panelListClasses.th} text-center`}>{t("Ngày đăng")}</th>
                </tr>
              </thead>
              <tbody className={panelListClasses.tbody}>
                {pagedProducts.map((row, idx) => {
                  const stt = (safeProductPage - 1) * productPageSize + idx + 1;
                  return (
                    <tr key={row.id} className={panelListRowClass()}>
                      <td className={`${panelListClasses.td} text-center text-gray-600`}>{stt}</td>
                      <td
                        className={`${panelListClasses.td} max-w-xs truncate font-medium text-gray-800`}
                        title={row.productName}
                      >
                        {row.productName || "—"}
                      </td>
                      <td className={`${panelListClasses.td} text-center text-gray-700`}>
                        {row.commissionPct}%
                      </td>
                      <td className={`${panelListClasses.td} text-center text-gray-700`}>
                        {row.sales.toLocaleString("vi-VN")}
                      </td>
                      <td
                        className={`${panelListClasses.td} text-right text-gray-700 whitespace-nowrap`}
                      >
                        {formatVnd(row.price)}
                      </td>
                      <td
                        className={`${panelListClasses.td} text-right text-gray-700 whitespace-nowrap`}
                      >
                        {formatVnd(row.commissionReceived)}
                      </td>
                      <td
                        className={`${panelListClasses.td} text-center text-gray-600 whitespace-nowrap`}
                      >
                        {formatPostedDate(row.postedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-gray-100">
            <PanelListPagination
              page={safeProductPage}
              totalPages={productTotalPages}
              pageSize={productPageSize}
              pageSizeOptions={[50, 100, 200, 300, 500, 1000, 1500]}
              from={(safeProductPage - 1) * productPageSize + 1}
              to={Math.min(safeProductPage * productPageSize, products.length)}
              total={products.length}
              onPageChange={setProductPage}
              onPageSizeChange={(size) => {
                setProductPageSize(size);
                setProductPage(1);
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  const gioSortSelectClass =
    "h-9 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-800 outline-none focus:border-teal-400 disabled:opacity-50";

  const gioStatusClass = (color?: GioVideoRow["statusColor"]) => {
    if (color === "ok") return "text-teal-700";
    if (color === "warn") return "text-amber-700";
    if (color === "error") return "text-rose-700";
    if (color === "running") return "text-blue-700";
    return "text-gray-600";
  };

  const gioCartClass = (color?: GioVideoRow["cartColor"]) => {
    if (color === "ok") return "text-teal-700 font-semibold";
    if (color === "warn") return "text-amber-700";
    return "text-gray-700";
  };

  const crawlGioVideoForm = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-4">
        <div>
          <p className="m-0 mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
            {t("Pool / Budget")}
          </p>
          <div className="space-y-2">
            <div className={splitRowClass}>
              <div className={splitLabelClass}>{t("Song song")}</div>
              <div className={splitInputWrapClass}>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={gioParallel}
                  disabled={gioCrawling}
                  onChange={(e) => setGioParallel(Math.max(1, Number(e.target.value) || 1))}
                  className={splitInputClass}
                  aria-label={t("Song song")}
                />
              </div>
            </div>
            <div className={splitRowClass}>
              <div className={splitLabelClass}>{t("Budget/profile")}</div>
              <div className={splitInputWrapClass}>
                <input
                  type="number"
                  min={1}
                  value={gioBudget}
                  disabled={gioCrawling}
                  onChange={(e) => setGioBudget(Math.max(1, Number(e.target.value) || 1))}
                  className={splitInputClass}
                  aria-label={t("Budget/profile")}
                />
              </div>
            </div>
          </div>
        </div>

        <div>
          <p className="m-0 mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
            {t("Tiêu chí lựa chọn")}
          </p>
          <div className="space-y-2">
            {gioSortRows.map((row, idx) => (
              <div key={`gio-sort-${idx}`}>
                <label className="m-0 mb-1 block text-10 font-semibold text-gray-500">
                  {t("Sắp xếp {{n}}", { n: idx + 1 })}
                </label>
                <div className="flex gap-2">
                  <select
                    value={row.field}
                    disabled={gioCrawling}
                    onChange={(e) =>
                      updateGioSortRow(idx, { field: e.target.value as GioVideoSortField })
                    }
                    className={gioSortSelectClass}
                    aria-label={t("Sắp xếp {{n}} — tiêu chí", { n: idx + 1 }) as string}
                  >
                    {GIO_VIDEO_SORT_FIELDS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.label)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={row.direction}
                    disabled={gioCrawling}
                    onChange={(e) =>
                      updateGioSortRow(idx, {
                        direction: e.target.value as GioVideoSortDirection,
                      })
                    }
                    className={gioSortSelectClass}
                    aria-label={t("Sắp xếp {{n}} — hướng", { n: idx + 1 }) as string}
                  >
                    {GIO_VIDEO_SORT_DIRECTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {t(opt.label)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 space-y-2 border-t border-gray-100 pt-3">
        {gioCrawlStatus ? (
          <p className="m-0 text-10 leading-relaxed text-gray-500">{gioCrawlStatus}</p>
        ) : null}
        <div className="flex flex-nowrap gap-2">
          <button
            type="button"
            disabled={gioCrawling}
            onClick={handleResetGioFilters}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-gray-300 bg-gray-200 px-2 text-xs font-bold text-gray-800 transition-colors hover:bg-gray-300 disabled:opacity-50"
          >
            {t("Lọc lại")}
          </button>
          <button
            type="button"
            onClick={handleStartGioCrawl}
            className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-2 text-xs font-bold text-white transition-colors ${
              gioCrawling
                ? "border-rose-600 bg-rose-600 hover:bg-rose-700"
                : "border-blue-600 bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {gioCrawling ? (
              <>
                <RiLoader4Line className="mr-1 animate-spin" />
                {t("Dừng")}
              </>
            ) : (
              t("Bắt đầu cào")
            )}
          </button>
        </div>
      </div>
    </div>
  );

  const gioVideoListPanel = (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="grid shrink-0 grid-cols-2 gap-2 border-b border-gray-100 px-3 py-2.5 sm:grid-cols-3">
        <div className="flex flex-row items-center justify-between gap-2 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-blue-600">
            {t("Tổng SP")}
          </p>
          <p className="m-0 text-lg font-bold tabular-nums text-blue-800">{gioVideoRows.length}</p>
        </div>
        <div className="flex flex-row items-center justify-between gap-2 rounded-lg border border-pink-300 bg-pink-100 px-3 py-2">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-pink-700">
            {t("Hoàn thành")}
          </p>
          <p className="m-0 text-lg font-bold tabular-nums text-pink-900">{gioCompletedCount}</p>
        </div>
        <div className="col-span-2 flex flex-row items-center justify-between gap-2 rounded-lg border border-purple-200 bg-purple-50 px-3 py-2 sm:col-span-1">
          <p className="m-0 text-10 font-semibold uppercase tracking-wide text-purple-600">
            {t("Trạng thái")}
          </p>
          <p className="m-0 truncate text-sm font-semibold text-purple-800">
            {gioCrawling ? t("Đang cào...") : gioCrawlStatus || t("Chưa chạy")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-2 justify-between items-center px-4 py-2 border-b border-gray-100">
        <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
          {t("Danh sách sản phẩm")}
        </p>
        <span className="text-xs text-gray-400">
          {t("Hoàn thành")}: <b className="text-teal-700">{gioCompletedCount}</b>
          <span className="mx-1 text-gray-300">·</span>
          {t("Tổng")}: <b className="text-gray-700">{gioVideoRows.length}</b>
        </span>
      </div>

      {!gioVideoRows.length ? (
        <div className={`flex-1 ${panelListClasses.empty}`}>
          {t("Chưa có dữ liệu. Chọn project / cấu hình rồi Bắt đầu cào.")}
        </div>
      ) : (
        <>
          <div
            className="min-h-0 overflow-x-auto overflow-y-auto"
            style={{ maxHeight: "calc(2.75rem + 10 * 2.75rem)" }}
          >
            <table className={panelListClasses.table}>
              <thead className="sticky top-0 z-10">
                <tr className="text-xs font-semibold text-gray-700 bg-bluegray-100 border-b border-gray-200">
                  <th className={`${panelListClasses.th} text-center w-14`}>{t("STT")}</th>
                  <th className={`${panelListClasses.th} text-left min-w-[10rem]`}>
                    {t("Sản phẩm gốc")}
                  </th>
                  <th className={`${panelListClasses.th} text-center`}>{t("SP tương tự")}</th>
                  <th className={`${panelListClasses.th} text-center`}>{t("QBá 7 ngày")}</th>
                  <th className={`${panelListClasses.th} text-center`}>{t("Giỏ video")}</th>
                  <th className={`${panelListClasses.th} text-center`}>{t("Trạng thái")}</th>
                </tr>
              </thead>
              <tbody className={panelListClasses.tbody}>
                {pagedGioVideoRows.map((row) => (
                  <tr key={row.id} className={panelListRowClass()}>
                    <td className={`${panelListClasses.td} text-center text-gray-600`}>{row.stt}</td>
                    <td
                      className={`${panelListClasses.td} max-w-xs truncate font-medium text-gray-800`}
                      title={row.name}
                    >
                      {row.name || "—"}
                    </td>
                    <td className={`${panelListClasses.td} text-center text-gray-700`}>
                      {row.similar || "—"}
                    </td>
                    <td className={`${panelListClasses.td} text-center text-gray-700`}>
                      {row.promoted || "—"}
                    </td>
                    <td className={`${panelListClasses.td} text-center ${gioCartClass(row.cartColor)}`}>
                      {row.cartText || "—"}
                    </td>
                    <td
                      className={`${panelListClasses.td} text-center whitespace-nowrap ${gioStatusClass(
                        row.statusColor
                      )}`}
                    >
                      {row.statusText || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="shrink-0 border-t border-gray-100">
            <PanelListPagination
              page={safeGioVideoPage}
              totalPages={gioVideoTotalPages}
              pageSize={gioVideoPageSize}
              pageSizeOptions={[50, 100, 200, 300, 500, 1000, 1500]}
              from={(safeGioVideoPage - 1) * gioVideoPageSize + 1}
              to={Math.min(safeGioVideoPage * gioVideoPageSize, gioVideoRows.length)}
              total={gioVideoRows.length}
              onPageChange={setGioVideoPage}
              onPageSizeChange={(size) => {
                setGioVideoPageSize(size);
                setGioVideoPage(1);
              }}
            />
          </div>
        </>
      )}
    </div>
  );

  const agentStatusChip =
    agentOnline === false ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-10 font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
        {t("Agent offline")}
      </span>
    ) : agentOnline === true && gemOnline === false ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-10 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {t("GemLogin offline")}
      </span>
    ) : agentOnline === true && gemOnline === true ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-10 font-semibold text-success-dark ring-1 ring-inset ring-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {t("Online · {{n}} profile", { n: gemProfiles.length })}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-10 font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
        {t("Đang kiểm tra…")}
      </span>
    );

  const hasOpenaiKey = Boolean(openaiKey.trim());
  const hasGeminiKey = Boolean(geminiKey.trim());

  const aiKeyFieldBtnClass =
    "inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-2.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100 disabled:opacity-50";

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-50 to-cyan-50 text-teal-600 ring-1 ring-teal-100">
              <RiDatabase2Line className="text-xl" />
            </div>
            <div className="min-w-0 space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="m-0 text-base font-bold tracking-tight text-gray-900">
                  {t("Cào dữ liệu")}
                </h3>
                {agentStatusChip}
                <button
                  type="button"
                  disabled={loadingGemProfiles}
                  onClick={() => void refreshAgentAndGem()}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
                  title={t("Kiểm tra lại Agent + GemLogin") as string}
                  aria-label={t("Kiểm tra lại Agent + GemLogin") as string}
                >
                  <RiRefreshLine className={`text-12 ${loadingGemProfiles ? "animate-spin" : ""}`} />
                </button>
              </div>
              <p className="m-0 text-xs leading-relaxed text-gray-500">
                {t("Local Agent · GemLogin · Cào / Xuất CSV")}
                {agentOnline === false ? (
                  <span className="ml-1 text-rose-600">— {t("tải & mở BatDau.bat")}</span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAiKeysDialogOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ring-1 ring-inset ${
                hasOpenaiKey
                  ? "bg-teal-50/80 ring-teal-200 hover:bg-teal-50"
                  : "bg-gray-50 ring-gray-200 hover:bg-gray-100"
              }`}
              title={t("Nhập OpenAI Key") as string}
            >
              <span className="text-xs font-bold text-gray-800">{t("OpenAI")}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-10 font-semibold ${
                  hasOpenaiKey
                    ? "bg-teal-100 text-teal-800"
                    : "bg-gray-200/80 text-gray-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasOpenaiKey ? "bg-teal-500" : "bg-gray-400"
                  }`}
                />
                {hasOpenaiKey ? t("Đã có Key") : t("Chưa có Key")}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAiKeysDialogOpen(true)}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-left transition-colors ring-1 ring-inset ${
                hasGeminiKey
                  ? "bg-teal-50/80 ring-teal-200 hover:bg-teal-50"
                  : "bg-gray-50 ring-gray-200 hover:bg-gray-100"
              }`}
              title={t("Nhập Gemini Key") as string}
            >
              <span className="text-xs font-bold text-gray-800">{t("Gemini")}</span>
              <span
                className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-10 font-semibold ${
                  hasGeminiKey
                    ? "bg-teal-100 text-teal-800"
                    : "bg-gray-200/80 text-gray-600"
                }`}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    hasGeminiKey ? "bg-teal-500" : "bg-gray-400"
                  }`}
                />
                {hasGeminiKey ? t("Đã có Key") : t("Chưa có Key")}
              </span>
            </button>
          </div>
        </div>
      </div>

      <section
        aria-labelledby="scrape-guide-title"
        className="overflow-hidden rounded-2xl border bg-white"
      >
        <div className={`px-4 sm:px-5 ${guideOpen ? "py-4 sm:py-5 space-y-4" : "py-1.5 sm:py-2"}`}>
          <div
            className={`flex flex-col sm:flex-row sm:items-center sm:justify-between ${
              guideOpen ? "gap-3" : "gap-2"
            }`}
          >
            <button
              type="button"
              onClick={() => setGuideOpen((v) => !v)}
              className={`flex min-w-0 flex-1 text-left rounded-lg -ml-1 px-1 transition-colors hover:bg-white/50 ${
                guideOpen ? "items-start gap-2 py-0.5" : "items-center gap-1.5 py-0"
              }`}
              aria-expanded={guideOpen}
              aria-controls="scrape-guide-body"
            >
              <span
                className={`inline-flex shrink-0 items-center justify-center rounded border border-bluegray-200 bg-white text-accent ${
                  guideOpen ? "mt-0.5 h-6 w-6 rounded-md" : "h-5 w-5"
                }`}
              >
                {guideOpen ? (
                  <HiChevronUp className="text-sm" />
                ) : (
                  <HiChevronDown className="text-xs" />
                )}
              </span>
              <span className={`min-w-0 ${guideOpen ? "space-y-1" : ""}`}>
                <span
                  className={`block font-semibold text-accent ${
                    guideOpen ? "text-16 tracking-wider uppercase" : "text-11 tracking-wide"
                  }`}
                >
                  {t("Hướng dẫn")}
                  <span className="mx-1.5 font-normal text-bluegray-400">·</span>
                  <span className={guideOpen ? "tracking-normal text-accent" : "font-medium"}>
                    {t("Quy trình cào Shopee Affiliate")}
                  </span>
                </span>
                {guideOpen ? (
                  <span className="block max-w-3xl text-12 leading-relaxed text-bluegray-500">
                    {t(
                      "Tải Agent về máy → mở GemLogin → Mở Trình duyệt → cào / xuất CSV. Trên domain HTTPS: khi Chrome hỏi quyền Local network hãy Allow (localhost web thì không cần)."
                    )}
                  </span>
                ) : null}
              </span>
            </button>
            <h4 id="scrape-guide-title" className="sr-only">
              {t("Quy trình cào Shopee Affiliate")}
            </h4>

            <div className="flex flex-wrap gap-2 items-center shrink-0 sm:justify-end">
              <label className="inline-flex items-center gap-1.5">
                <span className="text-10 font-semibold text-accent whitespace-nowrap">
                  {t("GemLogin")}
                </span>
                <select
                  value={gemProfileId}
                  onChange={(e) => setGemProfileId(e.target.value)}
                  disabled={opening || loadingGemProfiles}
                  className="h-9 min-w-40 max-w-56 text-xs font-semibold rounded-lg border border-bluegray-300 bg-white px-2 text-accent disabled:opacity-50"
                  aria-label={t("Profile GemLogin")}
                >
                  {!gemProfiles.length ? (
                    <option value="">{t("— Không có profile —")}</option>
                  ) : (
                    gemProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                disabled={loadingGemProfiles || opening}
                onClick={() => void refreshAgentAndGem()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-bluegray-300 bg-white px-2.5 text-10 font-semibold text-accent shadow-sm transition-colors hover:bg-bluegray-50 disabled:opacity-50"
                title={t("Làm mới Local Agent + profile GemLogin") as string}
              >
                {loadingGemProfiles ? (
                  <RiLoader4Line className="text-sm animate-spin" />
                ) : (
                  t("Làm mới")
                )}
              </button>
              <label className="inline-flex items-center gap-1.5">
                <span className="text-10 font-semibold text-accent whitespace-nowrap">
                  {t("Quốc gia")}
                </span>
                <select
                  value={openMarketHost}
                  onChange={(e) => setOpenMarketHost(e.target.value)}
                  disabled={opening}
                  className="h-9 min-w-28 text-xs font-semibold rounded-lg border border-bluegray-300 bg-white px-2 text-accent disabled:opacity-50"
                  aria-label={t("Quốc gia Affiliate")}
                >
                  {MARKET_OPTIONS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label} — {m.value}
                    </option>
                  ))}
                </select>
              </label>

              <button
                type="button"
                disabled={opening || !gemProfileId}
                onClick={() => void handleOpenBrowser()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {opening ? (
                  <RiLoader4Line className="text-base animate-spin" />
                ) : (
                  <HiPlay className="text-base" />
                )}
                {t("Mở Trình duyệt")}
              </button>
            </div>
          </div>

          {guideOpen ? (
            <div id="scrape-guide-body" className="space-y-4">
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 m-0 p-0 list-none">
                {GUIDE_STEPS.map((item) => {
                  const Icon = item.Icon;
                  const isDownloadStep = item.step === "01";
                  const isGemLoginStep = item.step === "02";
                  return (
                    <li
                      key={item.step}
                      className={`relative flex min-h-32 flex-col rounded-xl border p-3.5 shadow-sm transition-colors ${
                        isDownloadStep
                          ? "border-teal-300 bg-teal-50/70 hover:border-teal-400 hover:bg-teal-50"
                          : isGemLoginStep
                          ? "border-indigo-200 bg-indigo-50/50 hover:border-indigo-300 hover:bg-indigo-50"
                          : "border-bluegray-200 bg-bluegray-50 hover:border-bluegray-300 hover:bg-white"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <span
                            className={`shrink-0 text-16 font-semibold leading-none tracking-tight ${
                              isDownloadStep
                                ? "text-teal-400"
                                : isGemLoginStep
                                ? "text-indigo-300"
                                : "text-bluegray-300"
                            }`}
                          >
                            {item.step}
                          </span>
                          <p className="m-0 truncate text-13 font-bold text-accent">
                            {t(item.titleKey)}
                          </p>
                        </div>
                        <span
                          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-white ${
                            isDownloadStep
                              ? "border-teal-200 text-teal-700"
                              : isGemLoginStep
                              ? "border-indigo-200 text-indigo-700"
                              : "border-bluegray-200 text-bluegray-600"
                          }`}
                        >
                          <Icon className="text-15" />
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col gap-2 pt-2">
                        <p className="m-0 text-12 leading-relaxed text-bluegray-500">
                          {t(item.descKey)}
                        </p>
                        {isDownloadStep ? (
                          <div className="mt-auto flex flex-row gap-1.5">
                            <a
                              href={SCRAPE_AGENT_ZIP_WIN_URL}
                              download={SCRAPE_AGENT_ZIP_WIN_NAME}
                              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg bg-bluegray-600 px-2 text-12 font-semibold text-white shadow-sm transition-colors hover:bg-bluegray-700"
                            >
                              <HiDownload className="text-sm shrink-0" />
                              {t("Windows")}
                            </a>
                            <a
                              href={SCRAPE_AGENT_ZIP_MAC_URL}
                              download={SCRAPE_AGENT_ZIP_MAC_NAME}
                              className="inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1 rounded-lg border border-bluegray-400 bg-white px-2 text-12 font-semibold text-bluegray-800 shadow-sm transition-colors hover:bg-bluegray-50"
                            >
                              <HiDownload className="text-sm shrink-0" />
                              {t("Mac")}
                            </a>
                          </div>
                        ) : null}
                        {isGemLoginStep ? (
                          <a
                            href={GEMLOGIN_DOWNLOAD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-12 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                          >
                            <HiDownload className="text-sm" />
                            {t("Tải GemLogin")}
                          </a>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ol>

              <div className="border-t border-bluegray-200 pt-3">
                <p className="m-0 text-10 leading-relaxed text-bluegray-500">
                  <span className="font-semibold text-accent">{t("Mẹo")}:</span>{" "}
                  {t(
                    "UI báo Agent offline → mở lại BatDau.bat. bấm «Mở Trình duyệt» trước khi cào."
                  )}
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </section>

      {/* Một thẻ: tabs + form trái (cố định) + danh sách SP phải (flex) */}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <TabGroup
          name="scrape-data-sub"
          index={scrapeSubTab}
          onChange={setScrapeSubTab}
          flex
          hasInkBar={false}
          className="!bg-transparent"
          tabClassName="h-11 justify-center border-r border-gray-200 last:border-r-0 bg-gray-50"
          activeClassName="!text-primary-dark bg-success-light"
          titleClassName="text-sm font-bold whitespace-nowrap"
          bodyClassName="border-t border-gray-200 bg-white"
        >
          <TabGroup.Tab label={t("Crawl Project")}>
            <div className="flex min-h-96 overflow-hidden">
              <div className="w-80 shrink-0 border-r border-gray-200 p-4 overflow-y-auto">
                {crawlProjectForm}
              </div>
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{productListPanel}</div>
            </div>
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Crawl Giỏ Video")}>
            <div className="flex min-h-96 overflow-hidden">
              <div className="w-80 shrink-0 border-r border-gray-200 p-4 overflow-y-auto">
                {crawlGioVideoForm}
              </div>
              <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{gioVideoListPanel}</div>
            </div>
          </TabGroup.Tab>
        </TabGroup>
      </div>

      {/* Danh sách cào CSV — giữ như cũ */}
      <div className="p-4 space-y-3 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-wrap gap-2 justify-between items-center">
          <div className="flex gap-2 items-center">
            <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
              {t("Danh sách cào (CSV)")}
            </p>
            <span className="text-10 text-gray-400">
              {filteredSessions.length}/{sessions.length}
            </span>
          </div>
          <button
            type="button"
            disabled={!sessions.length}
            onClick={() => void handleDeleteAll()}
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40"
          >
            <HiOutlineTrash />
            {t("Xóa tất cả")}
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Domain")}</p>
            <select
              value={filterDomain}
              onChange={(e) => setFilterDomain(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {domainOptions.map((host) => (
                <option key={host} value={host}>
                  {domainLabel(host)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Năm")}</p>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {yearOptions.map((y) => (
                <option key={y} value={String(y)}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Tháng")}</p>
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={String(m)}>
                  {String(m).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">{t("Ngày")}</p>
            <select
              value={filterDay}
              onChange={(e) => setFilterDay(e.target.value)}
              className={selectClass}
            >
              <option value="">{t("Tất cả")}</option>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={String(d)}>
                  {String(d).padStart(2, "0")}
                </option>
              ))}
            </select>
          </div>
          {(filterDomain || filterYear || filterMonth || filterDay) && (
            <button
              type="button"
              onClick={clearFilters}
              className="h-8 px-2.5 text-xs font-semibold text-gray-600 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              {t("Xóa lọc")}
            </button>
          )}
        </div>

        {!sessions.length ? (
          <PanelListCard>
            <div className={panelListClasses.empty}>
              {t("Chưa có CSV. Mở GemLogin → Xuất CSV hoặc Lưu Project.")}
            </div>
          </PanelListCard>
        ) : !filteredSessions.length ? (
          <PanelListCard>
            <div className={panelListClasses.empty}>{t("Không có phiên khớp bộ lọc.")}</div>
          </PanelListCard>
        ) : (
          <>
            <PanelListCard>
              <div className="overflow-auto max-h-96">
                <table className={panelListClasses.table}>
                  <thead className="sticky top-0 z-10">
                    <tr className={panelListClasses.theadTr}>
                      <th className={`${panelListClasses.th} text-left`}>{t("Thời gian")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("Tên")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("Domain")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("Keyword")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("SP")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("Thực hiện")}</th>
                      <th className={`${panelListClasses.th} text-left`}>{t("ID")}</th>
                      <th className={`${panelListClasses.th} text-left`} />
                    </tr>
                  </thead>
                  <tbody className={panelListClasses.tbody}>
                    {pagedSessions.map((s) => (
                      <tr key={s.id} className={panelListRowClass()}>
                        <td className={`${panelListClasses.td} whitespace-nowrap text-gray-700`}>
                          {formatSessionTime(s.createdAt)}
                        </td>
                        <td
                          className={`${panelListClasses.td} max-w-2xs truncate font-semibold text-gray-800`}
                          title={sessionDisplayName(s)}
                        >
                          {sessionDisplayName(s)}
                        </td>
                        <td
                          className={`${panelListClasses.td} max-w-2xs truncate`}
                          title={s.marketHost}
                        >
                          {s.marketHost ? domainLabel(s.marketHost) : "—"}
                        </td>
                        <td
                          className={`${panelListClasses.td} max-w-2xs truncate`}
                          title={s.keyword}
                        >
                          {s.keyword || "—"}
                        </td>
                        <td className={`${panelListClasses.td} font-semibold text-gray-800`}>
                          {s.productCount}
                        </td>
                        <td className={`${panelListClasses.td} text-gray-600`}>
                          {formatDuration(s.durationMs)}
                        </td>
                        <td
                          className={`${panelListClasses.td} font-mono text-10 text-gray-400 max-w-28 truncate`}
                          title={s.id}
                        >
                          {s.id}
                        </td>
                        <td className={panelListClasses.td}>
                          <div className="flex gap-1 justify-end">
                            <button
                              type="button"
                              onClick={() => handleViewSession(s)}
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 text-10 font-semibold text-teal-800 hover:bg-teal-100"
                              title={t("Xem trong Danh sách sản phẩm") as string}
                            >
                              <HiEye />
                              {t("Xem")}
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                downloadCsvText(
                                  s.csv,
                                  `scrape-${s.keyword || "export"}-${s.id}.csv`
                                )
                              }
                              className="inline-flex h-7 items-center gap-1 rounded-md border border-gray-200 bg-white px-2 text-10 font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              <HiDownload />
                              CSV
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteOne(s.id)}
                              className="inline-flex h-7 items-center rounded-md border border-rose-200 bg-rose-50 px-2 text-10 font-semibold text-rose-700 hover:bg-rose-100"
                            >
                              <HiOutlineTrash />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </PanelListCard>

            <div className="flex flex-wrap gap-2 justify-between items-center pt-1">
              <div className="flex gap-2 items-center text-xs text-gray-500">
                <span>
                  {t("Trang")} {safePage}/{totalPages}
                  <span className="mx-1 text-gray-300">·</span>
                  {(safePage - 1) * pageSize + 1}–
                  {Math.min(safePage * pageSize, filteredSessions.length)} /{" "}
                  {filteredSessions.length}
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value) || 10)}
                  className="h-7 text-xs rounded-md border border-gray-200 bg-white px-1.5"
                  aria-label={t("Số dòng mỗi trang")}
                >
                  {[10, 20, 50, 100].map((n) => (
                    <option key={n} value={n}>
                      {n}/{t("trang")}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-1 items-center">
                <button
                  type="button"
                  disabled={safePage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={t("Trang trước")}
                >
                  <HiChevronLeft />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => {
                    if (totalPages <= 7) return true;
                    if (p === 1 || p === totalPages) return true;
                    return Math.abs(p - safePage) <= 1;
                  })
                  .reduce<number[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push(-p);
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p) =>
                    p < 0 ? (
                      <span key={`e${p}`} className="px-1 text-xs text-gray-400">
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setPage(p)}
                        className={`inline-flex h-7 min-w-7 items-center justify-center rounded-md border px-1.5 text-xs font-semibold transition-colors ${
                          p === safePage
                            ? "border-teal-300 bg-teal-50 text-teal-800"
                            : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}
                <button
                  type="button"
                  disabled={safePage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                  aria-label={t("Trang sau")}
                >
                  <HiChevronRight />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      <Dialog
        isOpen={aiKeysDialogOpen}
        onClose={() => setAiKeysDialogOpen(false)}
        title={t("API Keys")}
        width="480px"
        maxWidth="95vw"
      >
        <Dialog.Body>
          <div className="space-y-4 pt-1">
            <p className="m-0 text-xs text-gray-500">
              {t("Dùng cho Crawl Giỏ Video (lọc SP tương tự). Key lưu trên trình duyệt.")}
            </p>
            <div>
              <label
                className="m-0 mb-1.5 block text-sm font-semibold text-gray-800"
                htmlFor="scrape-openai-key"
              >
                {t("OpenAI Key")}
              </label>
              <div className="flex gap-1.5 items-center">
                <input
                  id="scrape-openai-key"
                  type={openaiKeyVisible ? "text" : "password"}
                  value={openaiKey}
                  onChange={(e) => persistOpenaiKey(e.target.value)}
                  placeholder="sk-..."
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => setOpenaiKeyVisible((v) => !v)}
                  className={aiKeyFieldBtnClass}
                >
                  {openaiKeyVisible ? t("Ẩn") : t("Hiện")}
                </button>
                <button
                  type="button"
                  disabled={checkingOpenaiKey}
                  onClick={() => void handleCheckOpenaiKey()}
                  className={`${aiKeyFieldBtnClass} text-teal-700`}
                >
                  {checkingOpenaiKey ? <RiLoader4Line className="animate-spin" /> : t("Check")}
                </button>
              </div>
            </div>
            <div>
              <label
                className="m-0 mb-1.5 block text-sm font-semibold text-gray-800"
                htmlFor="scrape-gemini-key"
              >
                {t("Gemini Key")}
              </label>
              <div className="flex gap-1.5 items-center">
                <input
                  id="scrape-gemini-key"
                  type={geminiKeyVisible ? "text" : "password"}
                  value={geminiKey}
                  onChange={(e) => persistGeminiKey(e.target.value)}
                  placeholder="AIza… / AQ…"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-teal-400"
                />
                <button
                  type="button"
                  onClick={() => setGeminiKeyVisible((v) => !v)}
                  className={aiKeyFieldBtnClass}
                >
                  {geminiKeyVisible ? t("Ẩn") : t("Hiện")}
                </button>
                <button
                  type="button"
                  disabled={checkingGeminiKey}
                  onClick={() => void handleCheckGeminiKey()}
                  className={`${aiKeyFieldBtnClass} text-teal-700`}
                >
                  {checkingGeminiKey ? <RiLoader4Line className="animate-spin" /> : t("Check")}
                </button>
              </div>
            </div>
            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setAiKeysDialogOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700"
              >
                {t("Xong")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={saveDialogOpen}
        onClose={() => {
          if (!savingProject) setSaveDialogOpen(false);
        }}
        title={t("Lưu Project")}
        width="420px"
        maxWidth="95vw"
      >
        <Dialog.Body>
          <div className="space-y-4 pt-1">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("Tên project")}
              </span>
              <input
                autoFocus
                value={saveProjectName}
                onChange={(e) => setSaveProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !savingProject) {
                    e.preventDefault();
                    void handleSaveProject();
                  }
                }}
                placeholder="Crawl Project 1"
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400"
              />
              <span className="mt-1 block text-xs text-gray-500">
                {t("Tên sẽ hiện trong Danh sách cào (CSV)")}
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={savingProject}
                onClick={() => setSaveDialogOpen(false)}
                className="h-9 rounded-lg bg-gray-600 px-4 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                disabled={savingProject || !saveProjectName.trim()}
                onClick={() => void handleSaveProject()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingProject ? <RiLoader4Line className="animate-spin" /> : null}
                {savingProject ? t("Đang tạo short link…") : t("Lưu")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
