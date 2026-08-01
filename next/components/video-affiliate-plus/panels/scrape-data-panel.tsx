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
  HiX,
} from "react-icons/hi";
import { RiChromeLine, RiCloudLine, RiDatabase2Line, RiKey2Line, RiLoader4Line, RiMagicLine, RiRefreshLine } from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Switch } from "../../shared/utilities/form";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import {
  formatDuration,
  formatSessionTime,
  isCrawlProjectSession,
  isGioVideoSession,
  nextCrawlProjectName,
  nextGioVideoProjectName,
  saveScrapeCsvSession,
  ScrapeCsvSession,
  sessionDisplayName,
} from "../scrape-csv-history";
import {
  downloadCsvText,
  exportShopeeAffiliateCsv,
  fetchGpmLoginProfiles,
  fetchGpmLoginStatus,
  GpmLoginProfileOption,
  loadScrapeCsvSessions,
  openShopeeAffiliateBrowser,
  probeScrapeAgent,
  removeScrapeCsvSession,
  SCRAPE_AGENT_BASE,
  shortenAffiliateLinks,
} from "../scrape/api";
import {
  AiAuthError,
  filterSimilarProductsWithAi,
  providerLabel,
  resolveAiApiKey,
  selectVideoCartWithAiMatches,
} from "../scrape/gio-video-ai";
import {
  fetchAffiliateProductDetail,
  formatPromoted7days,
  parseShopItemFromRowId,
  pickImageUrlFromRaw,
  type SimilarOfferItem,
} from "../scrape/gio-video-fetch";
import {
  fetchAffiliateProductPage,
  getCdpBridgeStatus,
  mapRawToScrapeRow,
  normalizeApiPriceFields,
  probeCdpBridge,
} from "../scrape/product-page-fetch";
import { buildProductSeoWorkItems, generateProductSeoBatch } from "../scrape/product-seo";
import { suggestShopeeKeywords, uniqueKeywords } from "../scrape/suggest-keywords";
import {
  PanelListCard,
  panelListClasses,
  PanelListPagination,
  panelListRowClass,
} from "../shared/panel-list-ui";
import { AffiliatePlusItem } from "../types";

type SaveProgressLog = {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
};

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
const GPMLOGIN_DOWNLOAD_URL = "https://gpmloginapp.com/vi/download";

const SCRAPE_OPENAI_KEY_LS = "video-affiliate-plus-scrape-openai-key";
const SCRAPE_GEMINI_KEY_LS = "video-affiliate-plus-scrape-gemini-key";
const SCRAPE_GATEWAY_ENDPOINT_LS = "video-affiliate-plus-scrape-gateway-endpoint";
const SCRAPE_GATEWAY_API_KEY_LS = "video-affiliate-plus-scrape-gateway-api-key";
const SCRAPE_GATEWAY_MODEL_LS = "video-affiliate-plus-scrape-gateway-model";
const SCRAPE_KEYWORDS_LS = "video-affiliate-plus-scrape-keywords";
const SCRAPE_KEYWORD_AI_LS = "video-affiliate-plus-scrape-keyword-ai";
/** Fallback model Gateway khi customer để trống — cùng DEFAULT_CHATGPT_MODEL. */
const DEFAULT_GATEWAY_MODEL = "gpt-5-5";
const MIN_AI_KEYWORDS = 200;

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
      "Tải zip Windows hoặc Mac → giải nén → chạy BatDau.bat / BatDau.command (tự cài Node nếu chưa có). Giữ cửa sổ mở.",
    Icon: RiDatabase2Line,
  },
  {
    step: "02",
    titleKey: "Mở GPM Login Desktop",
    descKey: "Cài và mở GPM Login → Tạo profile mới → Profile đã đăng nhập Shopee Affiliate.",
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

const SORT_TYPE_LABELS: Record<number, string> = {
  1: "Liên quan",
  2: "Bán chạy",
  3: "Giá cao → thấp",
  4: "Giá thấp → cao",
  5: "Hoa hồng (%)",
};

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
  /** Quảng bá 7 ngày — data.affiliate_promoted_last_7days */
  promoted: string;
  /** Giỏ video = similar đã sort (không AI) */
  cartText: string;
  cartColor?: "ok" | "warn" | "muted";
  statusText: string;
  statusColor?: "ok" | "warn" | "muted" | "error" | "running";
  /** Keys giỏ video đã sort: `shopId-itemId` */
  similarItemIds?: string[];
  /** Similar đầy đủ từ similar_product_offers.list (+ image-search) */
  similars?: SimilarOfferItem[];
  imageUrl?: string;
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

type GioVideoSortField = typeof GIO_VIDEO_SORT_FIELDS[number]["value"];
type GioVideoSortDirection = typeof GIO_VIDEO_SORT_DIRECTIONS[number]["value"];
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

/** Link SP để mở tab mới — ưu tiên product_link trong raw. */
function resolveScrapeProductUrl(row: ScrapeProductRow, marketHost: string): string {
  const raw = (row.raw || {}) as Record<string, unknown>;
  const fromRaw = String(
    raw.product_link ||
      raw.productLink ||
      raw.long_link ||
      raw.affiliate_link_short ||
      raw.affiliate_link ||
      ""
  ).trim();
  if (fromRaw) return fromRaw;

  const id = String(row.id || "").trim();
  const dash = id.indexOf("-");
  if (dash <= 0) return "";
  const shopId = id.slice(0, dash);
  const itemId = id.slice(dash + 1);
  if (!shopId || !itemId) return "";

  const host = String(marketHost || "").toLowerCase();
  const m = host.match(/^affiliate\.(shopee\..+)$/i);
  const mallHost = m?.[1] || "shopee.vn";
  return `https://${mallHost}/product/${shopId}/${itemId}`;
}

function mallHostFromAffiliate(marketHost: string): string {
  const host = String(marketHost || "").toLowerCase();
  const m = host.match(/^affiliate\.(shopee\..+)$/i);
  return m?.[1] || "shopee.vn";
}

/** URL SP từ key `shopId-itemId` hoặc itemId. */
function productUrlFromKey(key: string, marketHost: string): string {
  const raw = String(key || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const mallHost = mallHostFromAffiliate(marketHost);
  const dash = raw.indexOf("-");
  if (dash > 0) {
    const shopId = raw.slice(0, dash);
    const itemId = raw.slice(dash + 1);
    if (shopId && itemId && /^\d+$/.test(shopId) && /^\d+$/.test(itemId)) {
      return `https://${mallHost}/product/${shopId}/${itemId}`;
    }
  }
  if (/^\d+$/.test(raw)) return `https://${mallHost}/search?keyword=${raw}`;
  return "";
}

type GioCartLink = { key: string; name: string; url: string };

/** Giỏ video sau AI: SP gốc + các SP AI match (theo similarItemIds / similars). */
function collectGioCartLinks(row: GioVideoRow, marketHost: string): GioCartLink[] {
  const byKey = new Map<string, SimilarOfferItem>();
  for (const s of row.similars || []) {
    if (s?.key) byKey.set(s.key, s);
  }
  const ids =
    row.similarItemIds && row.similarItemIds.length
      ? row.similarItemIds
      : (row.similars || []).map((s) => s.key).filter(Boolean);

  const out: GioCartLink[] = [];
  const seen = new Set<string>();
  for (const key of ids) {
    const k = String(key || "").trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    const s = byKey.get(k);
    const url = String(s?.productLink || "").trim() || productUrlFromKey(k, marketHost);
    if (!url) continue;
    out.push({
      key: k,
      name: String(s?.name || (k === row.id ? row.name : "") || k).trim() || k,
      url,
    });
  }
  return out;
}

function escapeHtmlText(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Mở 1 tab trình duyệt lớn — bên trong có từng tab = link SP AI đã phân tích.
 * Tất cả iframe load trong cùng 1 cửa sổ.
 */
function openGioVideoCartBrowserTab(
  row: GioVideoRow,
  marketHost: string,
  t: (key: string, opts?: Record<string, unknown>) => string
): boolean {
  const links = collectGioCartLinks(row, marketHost);
  if (!links.length) return false;

  const title = escapeHtmlText(
    t("Giỏ video · {{name}}", { name: row.name || row.id }) as string
  );
  const tabsHtml = links
    .map((link, i) => {
      const label = escapeHtmlText(
        `${i + 1}. ${(link.name || link.key).slice(0, 48)}${
          (link.name || link.key).length > 48 ? "…" : ""
        }`
      );
      return `<button type="button" class="tab${i === 0 ? " active" : ""}" data-idx="${i}" title="${escapeHtmlText(
        link.name || link.key
      )}">${label}</button>`;
    })
    .join("");
  const panelsHtml = links
    .map((link, i) => {
      const safeUrl = escapeHtmlText(link.url);
      const safeName = escapeHtmlText(link.name || link.key);
      return `<div class="panel${i === 0 ? " active" : ""}" data-idx="${i}">
  <div class="bar">
    <a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeName}</a>
    <span class="url">${safeUrl}</span>
  </div>
  <iframe src="${safeUrl}" title="${safeName}" loading="${i === 0 ? "eager" : "lazy"}" referrerpolicy="no-referrer-when-downgrade"></iframe>
</div>`;
    })
    .join("");

  const html = `<!DOCTYPE html>
<html lang="vi">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>${title}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;height:100%;font-family:Segoe UI,system-ui,sans-serif;background:#0f172a;color:#e2e8f0}
  .wrap{display:flex;flex-direction:column;height:100%}
  .head{flex:0 0 auto;padding:10px 12px 0;border-bottom:1px solid #334155;background:#111827}
  .head h1{margin:0 0 8px;font-size:14px;font-weight:700;color:#f8fafc}
  .head p{margin:0 0 8px;font-size:11px;color:#94a3b8}
  .tabs{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px}
  .tab{flex:0 0 auto;max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
    border:1px solid #475569;background:#1e293b;color:#e2e8f0;border-radius:8px 8px 0 0;
    padding:7px 10px;font-size:12px;font-weight:600;cursor:pointer}
  .tab:hover{background:#334155}
  .tab.active{background:#0ea5e9;border-color:#0284c7;color:#fff}
  .body{flex:1 1 auto;min-height:0;position:relative;background:#020617}
  .panel{display:none;position:absolute;inset:0;flex-direction:column}
  .panel.active{display:flex}
  .bar{flex:0 0 auto;display:flex;gap:10px;align-items:center;padding:6px 10px;
    background:#1e293b;border-bottom:1px solid #334155;font-size:12px}
  .bar a{color:#38bdf8;font-weight:700;text-decoration:none;max-width:40%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .bar a:hover{text-decoration:underline}
  .bar .url{color:#94a3b8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  iframe{flex:1 1 auto;width:100%;border:0;background:#fff}
</style>
</head>
<body>
<div class="wrap">
  <div class="head">
    <h1>${title}</h1>
    <p>${escapeHtmlText(
      t(
        "{{n}} tab sản phẩm trong 1 cửa sổ — bấm tab để xem. Nếu Shopee chặn nhúng, bấm tên/link trên thanh để mở trang SP.",
        { n: links.length }
      ) as string
    )}</p>
    <div class="tabs" id="tabs">${tabsHtml}</div>
  </div>
  <div class="body" id="body">${panelsHtml}</div>
</div>
<script>
(function(){
  var tabs=document.getElementById('tabs');
  var body=document.getElementById('body');
  if(!tabs||!body)return;
  tabs.addEventListener('click',function(e){
    var btn=e.target&&e.target.closest?e.target.closest('.tab'):null;
    if(!btn)return;
    var idx=btn.getAttribute('data-idx');
    tabs.querySelectorAll('.tab').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-idx')===idx);});
    body.querySelectorAll('.panel').forEach(function(el){el.classList.toggle('active',el.getAttribute('data-idx')===idx);});
  });
})();
</script>
</body>
</html>`;

  const win = window.open("", "_blank");
  if (!win) return false;
  win.document.open();
  win.document.write(html);
  win.document.close();
  try {
    win.focus();
  } catch {
    /* ignore */
  }
  return true;
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
    const base = normalizeApiPriceFields({ ...(r.raw || {}) } as Record<string, unknown>);
    if (base.stt == null) base.stt = idx + 1;
    if (!base.id && r.id) base.id = r.id;
    if (base.affiliate_link_short == null) base.affiliate_link_short = "";
    if (base.long_link == null) base.long_link = "";
    if (base.description == null) base.description = "";
    if (base.hashtags == null) base.hashtags = "";
    return base;
  });

  const preferred = [
    "stt",
    "item_id",
    "itemid",
    "shopid",
    "name",
    "shop_name",
    "description",
    "hashtags",
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
    for (const key of Object.keys(row)) {
      if (key.startsWith("__")) continue;
      seen.add(key);
    }
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

const GIO_VIDEO_CSV_HEADERS = [
  "stt",
  "id",
  "name",
  "similar",
  "promoted",
  "cart_text",
  "status_text",
  "similar_keys",
  "gio_video",
  "image_url",
  /** product_link các SP similar đã chọn vào giỏ (cách nhau bởi |) */
  "similar_links",
  /** long_link affiliate các SP similar đã chọn (cách nhau bởi |) */
  "long_links",
] as const;

function gioVideoRowsToCsv(rows: GioVideoRow[]): string {
  const lines = [GIO_VIDEO_CSV_HEADERS.join(",")];
  for (const row of rows) {
    const keys = row.similarItemIds || [];
    // Giỏ = SP match đã sort (không gồm SP gốc trong row.similars)
    const cart = row.similars || [];
    const similarLinks = cart
      .map((s) => String(s.productLink || "").trim())
      .filter(Boolean)
      .join("|");
    const longLinks = cart
      .map((s) => String(s.longLink || "").trim())
      .filter(Boolean)
      .join("|");
    lines.push(
      [
        row.stt,
        row.id,
        row.name,
        row.similar,
        row.promoted,
        row.cartText,
        row.statusText,
        keys.join("|"),
        keys.join("|"),
        row.imageUrl || "",
        similarLinks,
        longLinks,
      ]
        .map((v) => escapeCsvValue(v))
        .join(",")
    );
  }
  return "\uFEFF" + lines.join("\n");
}

function parseGioVideoCsv(csv: string): GioVideoRow[] {
  const raws = parseScrapedCsvToRaws(csv);
  return raws.map((raw, index) => {
    const similarIds = String(raw.gio_video || raw.similar_keys || raw.similar_item_ids || "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean);
    const statusText = String(raw.status_text || "Hoàn thành");
    return {
      id: String(raw.id || `gio-${index + 1}`),
      stt: Number(raw.stt) || index + 1,
      name: String(raw.name || ""),
      similar: String(raw.similar || similarIds.length || "—"),
      promoted: String(raw.promoted || "—"),
      cartText: String(raw.cart_text || "—"),
      cartColor: similarIds.length > 0 || Number(raw.similar) > 0 ? "ok" : "muted",
      statusText,
      statusColor: /hoàn thành/i.test(statusText)
        ? "ok"
        : /lỗi|error/i.test(statusText)
        ? "error"
        : "muted",
      similarItemIds: similarIds,
      imageUrl: String(raw.image_url || ""),
    };
  });
}

/** Tab Cào dữ liệu — GPM Login CDP + danh sách SP / CSV. */
export function ScrapeDataPanel(_props: ScrapeDataPanelProps) {
  const { t } = useTranslation();
  const toast = useToast();

  const [sessions, setSessions] = useState<ScrapeCsvSession[]>([]);
  const [opening, setOpening] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  /** Market dùng khi Mở trình duyệt → /offer/product_offer */
  const [openMarketHost, setOpenMarketHost] = useState(MARKET_OPTIONS[0].value);
  const [gpmProfiles, setGpmProfiles] = useState<GpmLoginProfileOption[]>([]);
  const [gpmProfileId, setGpmProfileId] = useState("");
  const [loadingGpmProfiles, setLoadingGpmProfiles] = useState(false);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [gpmOnline, setGpmOnline] = useState<boolean | null>(null);
  const [filterDomain, setFilterDomain] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [filterMonth, setFilterMonth] = useState("");
  const [filterDay, setFilterDay] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [guideOpen, setGuideOpen] = useState(false);
  /** Danh sách từ khóa (chip) — persist localStorage, chỉ mất khi Clear. */
  const [keywords, setKeywords] = useState<string[]>([]);
  const [keywordDraft, setKeywordDraft] = useState("");
  /** Gợi ý AI khi bắt đầu cào (chỉ khi keywords đang trống). */
  const [keywordAiSuggest, setKeywordAiSuggest] = useState(false);
  const [suggestingKeywords, setSuggestingKeywords] = useState(false);
  /** Từ khóa đã cào xong trong phiên hiện tại → chip xanh. */
  const [doneKeywords, setDoneKeywords] = useState<string[]>([]);
  const [activeKeyword, setActiveKeyword] = useState("");
  const getKeywordsText = () => keywords.join(",");
  const persistKeywords = (list: string[]) => {
    const next = uniqueKeywords(list);
    setKeywords(next);
    writeScrapeAiKey(SCRAPE_KEYWORDS_LS, next.join(","));
  };
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveProjectName, setSaveProjectName] = useState("Crawl Project 1");
  /** Bật: ChatGPT tạo mô tả + hashtag khi Lưu Project. */
  const [saveUseAiSeo, setSaveUseAiSeo] = useState(true);
  const [savingProject, setSavingProject] = useState(false);
  /** Dialog Lưu project riêng cho Crawl Giỏ Video */
  const [gioSaveDialogOpen, setGioSaveDialogOpen] = useState(false);
  const [gioSaveProjectName, setGioSaveProjectName] = useState("Crawl Giỏ Video 1");
  const [savingGioProject, setSavingGioProject] = useState(false);
  /** Dialog theo dõi tiến trình Lưu Project (short link + AI SEO). */
  const [saveProgressOpen, setSaveProgressOpen] = useState(false);
  const [saveProgressPercent, setSaveProgressPercent] = useState(0);
  const [saveProgressStatus, setSaveProgressStatus] = useState("");
  const [saveProgressLogs, setSaveProgressLogs] = useState<SaveProgressLog[]>([]);
  const [saveProgressDone, setSaveProgressDone] = useState(false);
  const saveLogSeqRef = useRef(0);
  const saveLogBoxRef = useRef<HTMLDivElement>(null);
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
  /** Session Crawl Project đã lưu (IndexedDB) dùng làm nguồn SP cho Giỏ Video */
  const [gioSourceSessionId, setGioSourceSessionId] = useState("");
  const gioAbortRef = useRef(false);
  const gioSourceSessionIdRef = useRef("");
  const crawlingRef = useRef(false);
  /** Crawl Giỏ Video (live) đã kích hoạt Crawl Project — Dừng Giỏ sẽ dừng cả Project. */
  const gioCombinedCrawlRef = useRef(false);
  /** Song song thực tế sau khi check CDP (≤ slots CDP). */
  const gioEffectiveParallelRef = useRef(1);
  /** Không chọn Nguồn → SP từ Crawl Project được check Giỏ Video theo từng request. */
  const gioLiveRef = useRef<{
    active: boolean;
    queue: ScrapeProductRow[];
    processing: number;
    processedIds: Set<string>;
    done: number;
    failed: number;
    budget: number;
    stt: number;
    aiCred: {
      apiKey: string;
      provider: "openai" | "gemini" | "gateway";
      endpoint?: string;
      model?: string;
    } | null;
    sortSnapshot: GioVideoSortRow[];
  }>({
    active: false,
    queue: [],
    processing: 0,
    processedIds: new Set(),
    done: 0,
    failed: 0,
    budget: 100,
    stt: 0,
    aiCred: null,
    sortSnapshot: [],
  });

  useEffect(() => {
    gioSourceSessionIdRef.current = gioSourceSessionId;
  }, [gioSourceSessionId]);

  useEffect(() => {
    crawlingRef.current = crawling;
  }, [crawling]);

  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [gatewayEndpoint, setGatewayEndpoint] = useState("");
  const [gatewayApiKey, setGatewayApiKey] = useState("");
  const [gatewayModel, setGatewayModel] = useState("");
  const [openaiKeyVisible, setOpenaiKeyVisible] = useState(false);
  const [geminiKeyVisible, setGeminiKeyVisible] = useState(false);
  const [gatewayKeyVisible, setGatewayKeyVisible] = useState(false);
  const [checkingOpenaiKey, setCheckingOpenaiKey] = useState(false);
  const [checkingGeminiKey, setCheckingGeminiKey] = useState(false);
  const [aiKeysDialogOpen, setAiKeysDialogOpen] = useState(false);

  const refreshLocal = async () => {
    setSessions(await loadScrapeCsvSessions());
  };

  const refreshAgentAndGpm = async () => {
    setLoadingGpmProfiles(true);
    try {
      const agent = await probeScrapeAgent(2500);
      setAgentOnline(agent.online);
      if (!agent.online) {
        setGpmOnline(false);
        setGpmProfiles([]);
        return;
      }
      const status = await fetchGpmLoginStatus();
      setGpmOnline(Boolean(status.online));
      if (!status.online) {
        setGpmProfiles([]);
        return;
      }
      const list = await fetchGpmLoginProfiles();
      setGpmProfiles(list);
      setGpmProfileId((prev) => {
        if (prev && list.some((p) => p.id === prev)) return prev;
        return list[0]?.id || "";
      });
    } catch {
      setAgentOnline(false);
      setGpmOnline(false);
      setGpmProfiles([]);
    } finally {
      setLoadingGpmProfiles(false);
    }
  };

  useEffect(() => {
    void refreshLocal();
    void refreshAgentAndGpm();
    setOpenaiKey(readScrapeAiKey(SCRAPE_OPENAI_KEY_LS));
    setGeminiKey(readScrapeAiKey(SCRAPE_GEMINI_KEY_LS));
    setGatewayEndpoint(readScrapeAiKey(SCRAPE_GATEWAY_ENDPOINT_LS));
    setGatewayApiKey(readScrapeAiKey(SCRAPE_GATEWAY_API_KEY_LS));
    setGatewayModel(readScrapeAiKey(SCRAPE_GATEWAY_MODEL_LS));
    setKeywords(
      uniqueKeywords(
        readScrapeAiKey(SCRAPE_KEYWORDS_LS)
          .split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      )
    );
    try {
      const aiFlag = localStorage.getItem(SCRAPE_KEYWORD_AI_LS);
      setKeywordAiSuggest(aiFlag == null ? true : aiFlag === "1");
    } catch {
      setKeywordAiSuggest(true);
    }
  }, []);

  const loadAiKeysFromStorage = () => {
    setGatewayEndpoint(readScrapeAiKey(SCRAPE_GATEWAY_ENDPOINT_LS));
    setGatewayApiKey(readScrapeAiKey(SCRAPE_GATEWAY_API_KEY_LS));
    setGatewayModel(readScrapeAiKey(SCRAPE_GATEWAY_MODEL_LS));
    setOpenaiKey(readScrapeAiKey(SCRAPE_OPENAI_KEY_LS));
    setGeminiKey(readScrapeAiKey(SCRAPE_GEMINI_KEY_LS));
  };

  const openAiKeysDialog = () => {
    loadAiKeysFromStorage();
    setAiKeysDialogOpen(true);
  };

  const handleSaveAiKeys = () => {
    const ep = gatewayEndpoint.trim();
    const gwKey = gatewayApiKey.trim();
    const gwModel = gatewayModel.trim();
    const oai = openaiKey.trim();
    const gem = geminiKey.trim();
    const gwAny = Boolean(ep || gwKey || gwModel);
    const gwReady = Boolean(ep && gwKey && gwModel);
    if (gwAny && !gwReady) {
      toast.warn(
        t("Gateway cần đủ Endpoint, API Key và Model (hoặc để trống cả ba).")
      );
      return;
    }
    writeScrapeAiKey(SCRAPE_GATEWAY_ENDPOINT_LS, ep);
    writeScrapeAiKey(SCRAPE_GATEWAY_API_KEY_LS, gwKey);
    writeScrapeAiKey(SCRAPE_GATEWAY_MODEL_LS, gwModel);
    writeScrapeAiKey(SCRAPE_OPENAI_KEY_LS, oai);
    writeScrapeAiKey(SCRAPE_GEMINI_KEY_LS, gem);
    setGatewayEndpoint(ep);
    setGatewayApiKey(gwKey);
    setGatewayModel(gwModel);
    setOpenaiKey(oai);
    setGeminiKey(gem);
    toast.success(t("Đã lưu API Keys trên trình duyệt."));
    setAiKeysDialogOpen(false);
  };

  const persistKeywordAiSuggest = (value: boolean) => {
    setKeywordAiSuggest(value);
    try {
      localStorage.setItem(SCRAPE_KEYWORD_AI_LS, value ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  const commitKeywordDraft = (raw?: string) => {
    const parts = String(raw ?? keywordDraft)
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (!parts.length) {
      setKeywordDraft("");
      return;
    }
    persistKeywords([...keywords, ...parts]);
    setKeywordDraft("");
  };

  const removeKeywordAt = (index: number) => {
    persistKeywords(keywords.filter((_, i) => i !== index));
  };

  const clearKeywords = () => {
    persistKeywords([]);
    setKeywordDraft("");
    setDoneKeywords([]);
    setActiveKeyword("");
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
        toast.warn(t("Không kiểm tra trực tiếp từ trình duyệt (CORS). Key dạng sk-… đã lưu."));
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
        toast.warn(t("Không kiểm tra trực tiếp từ trình duyệt. Key dạng Gemini đã lưu."));
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

  const crawlProjectSessions = useMemo(
    () => sessions.filter((s) => isCrawlProjectSession(s)),
    [sessions]
  );
  const gioVideoSessions = useMemo(
    () => sessions.filter((s) => isGioVideoSession(s)),
    [sessions]
  );

  const filteredSessions = useMemo(() => {
    return crawlProjectSessions.filter((s) => {
      if (filterDomain && s.marketHost !== filterDomain) return false;
      const { year, month, day } = sessionLocalParts(s.createdAt);
      if (filterYear && year !== Number(filterYear)) return false;
      if (filterMonth && month !== Number(filterMonth)) return false;
      if (filterDay && day !== Number(filterDay)) return false;
      return true;
    });
  }, [crawlProjectSessions, filterDomain, filterYear, filterMonth, filterDay]);

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

  const updateGioSortRow = (index: number, patch: Partial<GioVideoSortRow>) => {
    setGioSortRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  };

  const patchGioRow = (id: string, patch: Partial<GioVideoRow>) => {
    setGioVideoRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const stopGioLiveFollow = () => {
    gioLiveRef.current.active = false;
    gioLiveRef.current.queue = [];
    gioLiveRef.current.processing = 0;
  };

  /**
   * Pool (Song song) không vượt số CDP/session sẵn sàng.
   * CDP không đủ → null (caller báo lỗi, không generate).
   */
  const resolveGioParallelFromCdp = async (): Promise<number | null> => {
    const status = await getCdpBridgeStatus();
    if (!status.ok || status.slots < 1) return null;
    const wanted = Math.max(1, Math.min(Number(gioParallel) || 1, 20));
    const parallel = Math.max(1, Math.min(wanted, status.slots, 5));
    gioEffectiveParallelRef.current = parallel;
    if (wanted > status.slots) {
      toast.warn(
        t("CDP chỉ có {{slots}} session — Song song hạ xuống {{n}}.", {
          slots: status.slots,
          n: parallel,
        })
      );
    }
    return parallel;
  };

  const processOneGioSeed = async (
    seed: ScrapeProductRow,
    aiCred: {
      apiKey: string;
      provider: "openai" | "gemini" | "gateway";
      endpoint?: string;
      model?: string;
    },
    sortSnapshot: GioVideoSortRow[]
  ): Promise<"ok" | "fail" | "abort"> => {
    const { shopId: seedShopId, itemId } = parseShopItemFromRowId(seed.id);
    if (!itemId) {
      patchGioRow(seed.id, {
        statusText: t("Thiếu item_id"),
        statusColor: "error",
      });
      return "fail";
    }

    patchGioRow(seed.id, {
      statusText: t("Đang lấy DETAIL..."),
      statusColor: "running",
    });

    try {
      const detail = await fetchAffiliateProductDetail({
        marketHost: openMarketHost,
        itemId,
        shopId: seedShopId || undefined,
      });

      if (gioAbortRef.current) return "abort";

      const imageUrl =
        detail.imageUrl || pickImageUrlFromRaw(seed.raw as Record<string, unknown> | undefined);
      const excludeKey = seedShopId ? `${seedShopId}-${itemId}` : itemId;
      const promoted = formatPromoted7days(detail.promoted7days);
      const detailCount = detail.similars.length || detail.similarItemIds.length;
      const originalName = detail.name || seed.productName || seed.id;

      patchGioRow(seed.id, {
        name: originalName,
        promoted,
        similar: String(detailCount),
        cartText: t("Đang AI lọc..."),
        cartColor: "muted",
        statusText: t("Đang AI lọc ({{provider}})...", {
          provider: providerLabel(aiCred.provider),
        }),
        statusColor: "running",
        imageUrl: imageUrl || detail.imageUrl || "",
      });

      if (gioAbortRef.current) return "abort";

      let matchedItems: { id: string; confidence: number }[] = [];
      let aiSummary = "";
      let aiFailed = false;
      let aiSkippedNoCdp = false;

      // Pool/Budget: chỉ generate AI khi CDP/session còn đủ
      if (detail.similars.length > 0) {
        const cdp = await getCdpBridgeStatus(3000);
        if (!cdp.ok || cdp.slots < 1) {
          aiSkippedNoCdp = true;
          patchGioRow(seed.id, {
            name: originalName,
            promoted,
            similar: String(detailCount),
            cartText: "—",
            cartColor: "muted",
            statusText: t("CDP không đủ — bỏ qua AI"),
            statusColor: "warn",
            imageUrl: imageUrl || detail.imageUrl || "",
          });
        } else {
          try {
            const ai = await filterSimilarProductsWithAi({
              originalName,
              similarItems: detail.similars.map((s) => ({
                id: s.itemId || s.key,
                name: s.name || s.key,
              })),
              apiKey: aiCred.apiKey,
              provider: aiCred.provider,
              endpoint: aiCred.endpoint,
              model: aiCred.model,
            });
            matchedItems = ai.matchedItems;
            aiSummary = ai.summary;
          } catch (aiErr: any) {
            aiFailed = true;
            if (aiErr instanceof AiAuthError) {
              gioAbortRef.current = true;
              throw aiErr;
            }
            console.warn("[gio-video] AI:", aiErr?.message || aiErr);
          }
        }
      }

      if (gioAbortRef.current) return "abort";

      const { cart, selectedIds, source, matchCount } = selectVideoCartWithAiMatches(
        detail.similars,
        matchedItems,
        excludeKey,
        itemId,
        sortSnapshot
      );
      const cartCount = selectedIds.length;

      patchGioRow(seed.id, {
        name: originalName,
        similar: String(detailCount),
        promoted,
        cartText: t("{{n}}", { n: cartCount }),
        cartColor: matchCount > 0 ? "ok" : "warn",
        statusText: aiSkippedNoCdp
          ? t("Hoàn thành · CDP không đủ → chỉ gốc")
          : source === "ai"
            ? t("Hoàn thành · AI match {{n}}{{summary}}", {
                n: matchCount,
                summary: aiSummary ? ` · ${aiSummary}` : "",
              })
            : aiFailed
              ? t("Hoàn thành · AI lỗi → chỉ gốc")
              : t("Hoàn thành · AI không match"),
        statusColor: "ok",
        similarItemIds: selectedIds,
        similars: cart,
        imageUrl: imageUrl || detail.imageUrl || "",
      });
      return "ok";
    } catch (err: any) {
      if (err instanceof AiAuthError) {
        toast.error(err.message || t("API key AI không hợp lệ"));
        gioAbortRef.current = true;
      }
      patchGioRow(seed.id, {
        statusText: err?.message ? String(err.message).slice(0, 80) : t("Lỗi"),
        statusColor: "error",
        cartText: "—",
        cartColor: "muted",
      });
      return "fail";
    }
  };

  const pumpGioLiveQueue = async () => {
    const live = gioLiveRef.current;
    const concurrency = Math.max(1, Math.min(gioEffectiveParallelRef.current || gioParallel, 5));
    while (
      live.active &&
      !gioAbortRef.current &&
      live.processing < concurrency &&
      live.queue.length > 0
    ) {
      const seed = live.queue.shift();
      if (!seed || !live.aiCred) break;
      live.processing += 1;
      void (async () => {
        try {
          const result = await processOneGioSeed(seed, live.aiCred!, live.sortSnapshot);
          if (result === "fail") live.failed += 1;
          if (result !== "abort") live.done += 1;
          setGioCrawlStatus(
            t("Giỏ Video (theo Crawl Project) · {{done}}/{{budget}} · lỗi {{fail}} · chờ {{q}}", {
              done: live.done,
              budget: live.budget,
              fail: live.failed,
              q: live.queue.length + live.processing - 1,
            })
          );
          } finally {
          live.processing -= 1;
          if (
            live.active &&
            !gioAbortRef.current &&
            (live.queue.length > 0 || live.processing > 0)
          ) {
            void pumpGioLiveQueue();
          } else if (
            live.active &&
            live.queue.length === 0 &&
            live.processing <= 0 &&
            !crawlingRef.current
          ) {
            live.active = false;
            setGioCrawling(false);
            setGioCrawlStatus(
              t("Hoàn tất · {{done}} SP · lỗi {{fail}}", {
                done: live.done,
                fail: live.failed,
              })
            );
          }
        }
      })();
    }
  };

  const finishGioLiveIfIdle = () => {
    const live = gioLiveRef.current;
    if (!live.active) return;
    if (live.queue.length > 0 || live.processing > 0) {
      void pumpGioLiveQueue();
      return;
    }
    live.active = false;
    setGioCrawling(false);
    setGioCrawlStatus(
      t("Hoàn tất · {{done}} SP · lỗi {{fail}}", {
        done: live.done,
        fail: live.failed,
      })
    );
  };

  /** Đưa SP từ Crawl Project vào check Giỏ Video (khi không chọn Nguồn). */
  const enqueueGioFromCrawlProduct = (product: ScrapeProductRow) => {
    if (gioSourceSessionIdRef.current) return;
    const live = gioLiveRef.current;
    if (!live.active || !live.aiCred) return;
    if (live.processedIds.has(product.id)) return;
    if (live.processedIds.size >= live.budget) return;
    live.processedIds.add(product.id);
    live.stt += 1;
    const stt = live.stt;
    setGioVideoRows((prev) => [
      ...prev,
      {
        id: product.id,
        stt,
        name: product.productName || product.id,
        similar: "—",
        promoted: "—",
        cartText: "—",
        cartColor: "muted",
        statusText: t("Chờ..."),
        statusColor: "muted",
      },
    ]);
    live.queue.push(product);
    void pumpGioLiveQueue();
  };

  const startGioLiveFollow = (aiCred: {
    apiKey: string;
    provider: "openai" | "gemini" | "gateway";
    endpoint?: string;
    model?: string;
  }) => {
    gioAbortRef.current = false;
    gioLiveRef.current = {
      active: true,
      queue: [],
      processing: 0,
      processedIds: new Set(),
      done: 0,
      failed: 0,
      budget: Math.max(1, gioBudget),
      stt: 0,
      aiCred,
      sortSnapshot: gioSortRows.map((r) => ({ ...r })),
    };
    setGioVideoRows([]);
    setGioVideoPage(1);
    setGioCrawling(true);
    setGioCrawlStatus(
      t("Chờ SP từ Crawl Project · AI {{provider}} · budget {{b}} · song song {{p}}", {
        provider: providerLabel(aiCred.provider),
        b: Math.max(1, gioBudget),
        p: Math.max(1, gioEffectiveParallelRef.current),
      })
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

  const handleStartGioCrawl = async () => {
    if (gioCrawling) {
      gioAbortRef.current = true;
      stopGioLiveFollow();
      if (gioCombinedCrawlRef.current) {
        crawlAbortRef.current = true;
        gioCombinedCrawlRef.current = false;
        setCrawlStatus(t("Đang dừng..."));
      }
      setGioCrawlStatus(t("Đang dừng..."));
      setGioCrawling(false);
      return;
    }

    let aiCred: {
      apiKey: string;
      provider: "openai" | "gemini" | "gateway";
      endpoint?: string;
      model?: string;
    };
    try {
      aiCred = resolveAiApiKey(openaiKey, geminiKey, {
        endpoint: gatewayEndpoint,
        apiKey: gatewayApiKey,
        model: gatewayModel.trim(),
      });
    } catch {
      toast.warn(
        t(
          "Nhập Endpoint + API Key + Model (gateway), hoặc OpenAI/Gemini Key trước khi cào Giỏ Video."
        )
      );
      openAiKeysDialog();
      return;
    }

    // Pool / Budget: CDP phải đủ mới generate (Song song ≤ slots)
    const parallel = await resolveGioParallelFromCdp();
    if (parallel == null) {
      const agent = await probeScrapeAgent(2000);
      toast.error(
        agent.online
          ? t(
              "CDP không đủ để cào Giỏ Video. Bấm «Mở Trình duyệt» (GPM Login), đăng nhập Affiliate nếu cần, rồi thử lại."
            )
          : t("Chưa thấy Local Agent. Mở Shopee Scrape Agent (BatDau.bat / .exe).")
      );
      return;
    }

    // Không chọn Nguồn → chạy Crawl Project + check Giỏ Video (live)
    if (!gioSourceSessionId) {
      const existing = products.slice(0, Math.max(1, gioBudget));
      startGioLiveFollow(aiCred);
      if (existing.length) {
        for (const p of existing) enqueueGioFromCrawlProduct(p);
      }
      const shouldStartProject = !crawling && !crawlingRef.current;
      if (shouldStartProject) {
        gioCombinedCrawlRef.current = true;
        toast.info(
          existing.length
            ? t(
                "Crawl Giỏ Video + Crawl Project · check {{n}} SP hiện có + SP mới (budget {{b}}).",
                { n: existing.length, b: Math.max(1, gioBudget) }
              )
            : t(
                "Crawl Giỏ Video + Crawl Project · mỗi SP mới sẽ được check Giỏ Video (budget {{b}}).",
                { b: Math.max(1, gioBudget) }
              )
        );
        void handleStartCrawl();
      } else {
        gioCombinedCrawlRef.current = false;
        toast.info(
          existing.length
            ? t("Theo dõi Crawl Project đang chạy · check {{n}} SP hiện có + SP mới.", {
                n: existing.length,
              })
            : t("Theo dõi Crawl Project đang chạy — mỗi SP mới sẽ được check Giỏ Video.")
        );
      }
      return;
    }

    const seeds = products.slice(0, Math.max(1, gioBudget));
    if (!seeds.length) {
      toast.warn(
        t(
          "Chưa có SP nguồn. Chọn Crawl Project đã lưu, hoặc bỏ trống Nguồn để theo Crawl Project."
        )
      );
      return;
    }

    gioAbortRef.current = false;
    gioCombinedCrawlRef.current = false;
    stopGioLiveFollow();
    setGioCrawling(true);
    setGioVideoPage(1);

    const sortSnapshot = gioSortRows.map((r) => ({ ...r }));

    const initialRows: GioVideoRow[] = seeds.map((p, i) => ({
      id: p.id,
      stt: i + 1,
      name: p.productName || p.id,
      similar: "—",
      promoted: "—",
      cartText: "—",
      cartColor: "muted",
      statusText: t("Chờ..."),
      statusColor: "muted",
    }));
    setGioVideoRows(initialRows);
    setGioCrawlStatus(
      t("Đang cào giỏ video · {{n}} SP · AI {{provider}} · song song {{p}}", {
        n: seeds.length,
        provider: providerLabel(aiCred.provider),
        p: parallel,
      })
    );

    let done = 0;
    let failed = 0;
    const concurrency = Math.max(1, Math.min(parallel, 5));
    let cursor = 0;

    const worker = async () => {
      while (!gioAbortRef.current) {
        const idx = cursor++;
        if (idx >= seeds.length) return;
        const seed = seeds[idx];
        const result = await processOneGioSeed(seed, aiCred, sortSnapshot);
        if (result === "fail") failed += 1;
        if (result !== "abort") done += 1;
        setGioCrawlStatus(
          t("Đang cào giỏ video · {{done}}/{{total}} · lỗi {{fail}}", {
            done,
            total: seeds.length,
            fail: failed,
          })
        );
      }
    };

    try {
      await Promise.all(Array.from({ length: concurrency }, () => worker()));
      const stopped = gioAbortRef.current;
      setGioCrawlStatus(
        stopped
          ? t("Đã dừng · xong {{done}}/{{total}} · lỗi {{fail}}", {
              done,
              total: seeds.length,
              fail: failed,
            })
          : t("Hoàn tất · {{done}} SP · lỗi {{fail}}", {
              done,
              fail: failed,
            })
      );
      if (!stopped && failed === 0) {
        toast.success(t("Crawl Giỏ Video xong · {{n}} SP", { n: seeds.length }));
      } else if (!stopped && failed > 0) {
        toast.warn(t("Xong với {{fail}} lỗi / {{total}} SP", { fail: failed, total: seeds.length }));
      }
    } catch (err: any) {
      toast.error(err?.message || t("Crawl Giỏ Video thất bại"));
      setGioCrawlStatus(err?.message || t("Lỗi"));
    } finally {
      setGioCrawling(false);
      gioAbortRef.current = false;
    }
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
    if (!gpmProfileId) {
      toast.warn(t("Chọn profile GPM Login trước. Bấm làm mới nếu danh sách trống."));
      void refreshAgentAndGpm();
      return;
    }
    try {
      setOpening(true);
      toast.info(
        t(
          "Đang mở GPM… Nếu chưa login Affiliate, đăng nhập + xác thực trên cửa sổ GPM — hệ thống sẽ chờ tới ~5 phút."
        )
      );
      const result = await openShopeeAffiliateBrowser({
        marketHost: openMarketHost,
        gpmloginProfileId: gpmProfileId,
      });
      toast.success(
        t("Đã mở GPM Login + capture session. Giữ cửa sổ mở rồi Bắt đầu cào.", {
          n: result.cookieCount ?? 0,
        })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được trình duyệt"));
      void refreshAgentAndGpm();
    } finally {
      setOpening(false);
    }
  };

  const handleExportCsv = async () => {
    if (exportingCsv) return;
    const keyword = keywords[0] || "";
    try {
      setExportingCsv(true);
      const bridgeOk = await probeCdpBridge();
      if (!bridgeOk) {
        const agent = await probeScrapeAgent(2000);
        toast.error(
          agent.online
            ? t("Chưa có cookie. Bấm «Mở Trình duyệt» (GPM Login) trước.")
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
      if (gioSourceSessionId === id) setGioSourceSessionId("");
      toast.warn(t("Đã xóa phiên CSV"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  /** Load SP từ session Crawl Project đã lưu → `products` (nguồn cho Giỏ Video). */
  const loadSessionProducts = (
    session: ScrapeCsvSession,
    opts?: { scroll?: boolean; toastOk?: boolean }
  ): number => {
    const raws = parseScrapedCsvToRaws(session.csv);
    if (!raws.length) {
      throw new Error(t("File CSV trống hoặc không đọc được"));
    }
    const mapped: ScrapeProductRow[] = raws.map((raw, index) => {
      const priced = {
        ...raw,
        __priceVndNormalized: true,
      } as Record<string, unknown>;
      const row = mapRawToScrapeRow(priced, index);
      return { ...row, raw: priced };
    });
    setProducts(mapped);
    setCrawledCount(mapped.length);
    setCrawlStatus("view");
    setGioSourceSessionId(session.id);
    if (session.marketHost) setOpenMarketHost(session.marketHost);
    if (session.keyword) {
      persistKeywords(
        uniqueKeywords(
          String(session.keyword)
            .split(/[,;\n]+/)
            .map((k) => k.trim())
            .filter(Boolean)
        )
      );
    }
    if (opts?.toastOk !== false) {
      toast.success(
        t("Đã mở «{{name}}» · {{count}} SP", {
          name: sessionDisplayName(session),
          count: mapped.length,
        })
      );
    }
    if (opts?.scroll) {
      window.requestAnimationFrame(() => {
        document.getElementById("scrape-product-list")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
    }
    return mapped.length;
  };

  const handleViewSession = (session: ScrapeCsvSession) => {
    try {
      loadSessionProducts(session, { scroll: true });
      setScrapeSubTab(0);
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được file CSV"));
    }
  };

  const handleSelectGioSourceSession = (sessionId: string) => {
    if (!sessionId) {
      setGioSourceSessionId("");
      return;
    }
    const session = crawlProjectSessions.find((s) => s.id === sessionId);
    if (!session) {
      toast.warn(t("Không tìm thấy Crawl Project đã lưu"));
      setGioSourceSessionId("");
      return;
    }
    try {
      loadSessionProducts(session, { scroll: false });
      setGioCrawlStatus(
        t("Nguồn: «{{name}}» · {{count}} SP", {
          name: sessionDisplayName(session),
          count: session.productCount || 0,
        })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được file CSV"));
    }
  };

  const handleDeleteAll = async () => {
    if (!crawlProjectSessions.length) return;
    if (!window.confirm(t("Xóa tất cả Crawl Project đã lưu?"))) return;
    try {
      for (const s of crawlProjectSessions) {
        await removeScrapeCsvSession(s.id);
      }
      setSessions(await loadScrapeCsvSessions());
      setGioSourceSessionId("");
      toast.warn(t("Đã xóa tất cả Crawl Project"));
    } catch (err: any) {
      toast.error(err?.message || t("Xóa thất bại"));
    }
  };

  const handleResetFilters = () => {
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
    if (crawling || suggestingKeywords) {
      if (crawling) {
        crawlAbortRef.current = true;
        setCrawlStatus(t("Đang dừng..."));
      }
      return;
    }

    let keywordList = [...keywords];

    // Gợi ý AI chỉ khi bật + input đang trống (có value = user/đã lưu → không call lại)
    if (keywordAiSuggest && keywordList.length === 0) {
      try {
        setSuggestingKeywords(true);
        setCrawlStatus(t("AI đang gợi ý từ khóa Shopee (≥{{n}})…", { n: MIN_AI_KEYWORDS }));
        const { keywords: suggested, provider } = await suggestShopeeKeywords({
          openaiKey,
          geminiKey,
          gatewayEndpoint,
          gatewayApiKey,
          gatewayModel: gatewayModel.trim(),
          minCount: MIN_AI_KEYWORDS,
        });
        keywordList = uniqueKeywords([...keywordList, ...suggested]);
        persistKeywords(keywordList);
        toast.success(
          t("AI ({{provider}}) đã thêm {{count}} từ khóa", {
            provider: providerLabel(provider),
            count: suggested.length,
          })
        );
        if (suggested.length < MIN_AI_KEYWORDS) {
          toast.warn(
            t("AI chỉ trả {{count}}/{{min}} từ khóa — vẫn tiếp tục cào.", {
              count: suggested.length,
              min: MIN_AI_KEYWORDS,
            })
          );
        }
      } catch (err: any) {
        setCrawlStatus("");
        toast.error(err?.message || t("Gợi ý từ khóa AI thất bại"));
        if (err instanceof AiAuthError) openAiKeysDialog();
        return;
      } finally {
        setSuggestingKeywords(false);
      }
    }

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
              "Chưa có cookie. Bấm «Mở Trình duyệt» (GPM Login), đăng nhập Affiliate nếu cần, rồi thử lại."
            )
          : t("Chưa thấy Local Agent. Mở Shopee Scrape Agent (BatDau.bat / .exe).")
      );
      return;
    }

    crawlAbortRef.current = false;
    setCrawling(true);
    crawlingRef.current = true;
    setProducts([]);
    setCrawledCount(0);
    setDoneKeywords([]);
    setActiveKeyword("");

    // Crawl Project chỉ cào SP. Check Giỏ Video chỉ khi đã bật từ nút «Crawl Giỏ Video».

    const accepted: ScrapeProductRow[] = [];
    const seen = new Set<string>();
    const pageLimit = 20;
    const delayMs = 450;
    // Shopee cap ~500 SP / keyword+sort → ~25 trang; dư buffer nhẹ
    const maxPagesPerKeyword = 30;
    const activeSort = Number(sortType) || 1;
    const sortLabel = t(SORT_TYPE_LABELS[activeSort] || String(activeSort));
    const shopFilters = orderedShopTypes();
    let scannedRaw = 0;

    try {
      for (const keyword of crawlKeywords) {
        if (crawlAbortRef.current || accepted.length >= productLimit) break;
        const keywordLabel = keyword || t("(không từ khóa)");
        if (keyword) setActiveKeyword(keyword);

        // Giữ đúng sort user chọn; hết ~500 / hết data → sang từ khóa tiếp
        let pageOffset = 0;
        let pageNo = 0;
        let scannedThisKeyword = 0;

        while (
          !crawlAbortRef.current &&
          accepted.length < productLimit &&
          pageNo < maxPagesPerKeyword
        ) {
          pageNo += 1;
          setCrawlStatus(
            t(
              'Đang cào "{{keyword}}" · {{sort}} · trang {{page}} · đã cào {{scanned}} · khớp {{count}}/{{limit}}',
              {
                keyword: keywordLabel,
                sort: sortLabel,
                page: pageNo,
                scanned: scannedRaw,
                count: accepted.length,
                limit: productLimit,
              }
            )
          );

          let page: Awaited<ReturnType<typeof fetchAffiliateProductPage>>;
          try {
            page = await fetchAffiliateProductPage({
              marketHost: openMarketHost,
              keyword,
              sortType: activeSort,
              pageOffset,
              pageLimit,
              listType: 0,
              filterShopTypes: shopFilters,
            });
          } catch (pageErr: any) {
            const msg = String(pageErr?.message || pageErr || "");
            // Lỗi tạm → bỏ từ khóa này, sang từ khóa tiếp (không đổi sort)
            setCrawlStatus(
              t(
                'Lỗi trang {{page}} ({{sort}}) · bỏ qua từ khóa · {{error}} · khớp {{count}}/{{limit}}',
                {
                  page: pageNo,
                  sort: sortLabel,
                  error: msg.slice(0, 80),
                  count: accepted.length,
                  limit: productLimit,
                }
              )
            );
            toast.warn(
              t("Bỏ qua trang lỗi · sang từ khóa tiếp ({{count}} SP)", {
                count: accepted.length,
              })
            );
            await new Promise((r) => setTimeout(r, 900));
            break;
          }

          if (!page.products.length) break;

          scannedRaw += page.products.length;
          scannedThisKeyword += page.products.length;
          setCrawledCount(scannedRaw);

          let newIdsOnPage = 0;
          for (const raw of page.products) {
            if (accepted.length >= productLimit) break;
            const normalizedRaw = normalizeApiPriceFields(
              raw as Record<string, unknown>
            );
            const mapped = mapRawToScrapeRow(normalizedRaw, accepted.length);
            if (!mapped.id || seen.has(mapped.id)) continue;
            seen.add(mapped.id);
            newIdsOnPage += 1;
            if (!passesFilters(mapped)) continue;
            accepted.push({
              id: mapped.id,
              productName: mapped.productName,
              commissionPct: mapped.commissionPct,
              sales: mapped.sales,
              price: mapped.price,
              commissionReceived: mapped.commissionReceived,
              postedAt: mapped.postedAt,
              raw: normalizedRaw,
            });
            setProducts([...accepted]);
            enqueueGioFromCrawlProduct(accepted[accepted.length - 1]);
          }

          setCrawlStatus(
            t(
              'Đang cào "{{keyword}}" · {{sort}} · trang {{page}} · đã cào {{scanned}} · khớp {{count}}/{{limit}}',
              {
                keyword: keywordLabel,
                sort: sortLabel,
                page: pageNo,
                scanned: scannedRaw,
                count: accepted.length,
                limit: productLimit,
              }
            )
          );

          if (accepted.length >= productLimit) break;
          // Hết data / API lặp / gần cap ~500 → sang từ khóa mới (giữ sort)
          if (newIdsOnPage === 0) break;
          if (!page.hasMore) break;
          if (scannedThisKeyword >= 500) break;
          pageOffset += pageLimit;
          await new Promise((r) => setTimeout(r, delayMs));
        }

        // Từ khóa đã hết lượt request (hết data hoặc đạt limit) → đánh dấu xanh
        if (keyword) {
          setDoneKeywords((prev) =>
            prev.includes(keyword) ? prev : [...prev, keyword]
          );
          setActiveKeyword("");
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
      crawlingRef.current = false;
      setActiveKeyword("");
      crawlAbortRef.current = false;
      gioCombinedCrawlRef.current = false;
      finishGioLiveIfIdle();
    }
  };

  const openSaveProjectDialog = () => {
    if (!products.length) {
      toast.warn(t("Chưa có sản phẩm để lưu"));
      return;
    }
    setSaveProjectName(nextCrawlProjectName(crawlProjectSessions));
    setSaveDialogOpen(true);
  };

  const openSaveGioProjectDialog = () => {
    if (!gioVideoRows.length) {
      toast.warn(t("Chưa có kết quả Giỏ Video để lưu"));
      return;
    }
    setGioSaveProjectName(nextGioVideoProjectName(gioVideoSessions));
    setGioSaveDialogOpen(true);
  };

  const handleSaveGioProject = async () => {
    if (!gioVideoRows.length) {
      toast.warn(t("Chưa có kết quả Giỏ Video để lưu"));
      return;
    }
    const name = gioSaveProjectName.trim() || nextGioVideoProjectName(gioVideoSessions);
    setGioSaveDialogOpen(false);
    setSavingGioProject(true);
    try {
      const csv = gioVideoRowsToCsv(gioVideoRows);
      const sourceSession = crawlProjectSessions.find((s) => s.id === gioSourceSessionId);
      await saveScrapeCsvSession({
        name,
        kind: "gio-video",
        keyword: sourceSession ? sessionDisplayName(sourceSession) : name,
        marketHost: openMarketHost,
        marketCode: "",
        productCount: gioVideoRows.length,
        csv,
        durationMs: 0,
      });
      setSessions(await loadScrapeCsvSessions());
      toast.success(t("Đã lưu «{{name}}» · {{count}} SP", { name, count: gioVideoRows.length }));
    } catch (err: any) {
      toast.error(err?.message || t("Lưu project Giỏ Video thất bại"));
    } finally {
      setSavingGioProject(false);
    }
  };

  const handleViewGioSession = (session: ScrapeCsvSession) => {
    try {
      const rows = parseGioVideoCsv(session.csv);
      if (!rows.length) {
        toast.warn(t("File CSV trống hoặc không đọc được"));
        return;
      }
      setGioVideoRows(rows);
      setGioVideoPage(1);
      setGioCrawlStatus(
        t("Đã mở «{{name}}» · {{count}} SP", {
          name: sessionDisplayName(session),
          count: rows.length,
        })
      );
      if (session.marketHost) setOpenMarketHost(session.marketHost);
      setScrapeSubTab(1);
      toast.success(
        t("Đã mở «{{name}}» · {{count}} SP", {
          name: sessionDisplayName(session),
          count: rows.length,
        })
      );
    } catch (err: any) {
      toast.error(err?.message || t("Không mở được file CSV"));
    }
  };

  const formatSaveLogTime = () => {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, "0"))
      .join(":");
  };

  const pushSaveLog = (message: string, level: SaveProgressLog["level"] = "info") => {
    saveLogSeqRef.current += 1;
    const entry: SaveProgressLog = {
      id: `save-log-${saveLogSeqRef.current}`,
      time: formatSaveLogTime(),
      level,
      message,
    };
    setSaveProgressLogs((prev) => [...prev, entry]);
    requestAnimationFrame(() => {
      const el = saveLogBoxRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  };

  const handleSaveProject = async () => {
    if (!products.length) {
      toast.warn(t("Chưa có sản phẩm để lưu"));
      return;
    }
    const name = saveProjectName.trim() || nextCrawlProjectName(crawlProjectSessions);

    setSaveDialogOpen(false);
    setSavingProject(true);
    setSaveProgressOpen(true);
    setSaveProgressDone(false);
    setSaveProgressPercent(0);
    setSaveProgressStatus(t("Đang khởi tạo…") as string);
    setSaveProgressLogs([]);
    saveLogSeqRef.current = 0;

    try {
      pushSaveLog(`Bắt đầu lưu «${name}» · ${products.length} SP`, "info");

      // ── 1) long_link → affiliate_link_short ──
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

      let productsWithShort: ScrapeProductRow[] = products.map((p) => ({
        ...p,
        raw: {
          ...(p.raw || {}),
          affiliate_link_short: String((p.raw as any)?.affiliate_link_short || ""),
          description: String((p.raw as any)?.description || ""),
          hashtags: String((p.raw as any)?.hashtags || ""),
        },
      }));

      setSaveProgressPercent(5);
      setSaveProgressStatus(t("Tạo short link…") as string);

      if (linkRows.length) {
        const bridgeOk = await probeCdpBridge();
        if (!bridgeOk) {
          throw new Error(
            t(
              "Chưa có cookie. Bấm «Mở Trình duyệt» trước khi lưu (cần để tạo short link)."
            ) as string
          );
        }
        pushSaveLog(`Đang tạo short link ${linkRows.length} SP…`, "info");
        try {
          const shorts = await shortenAffiliateLinks(
            linkRows.map((r) => r.link),
            800
          );
          const filled = shorts.filter(Boolean).length;
          if (filled === 0) {
            pushSaveLog(
              "Chưa tạo được short link (antibot/GPM Login). Vẫn lưu bằng long_link.",
              "warning"
            );
          } else {
            productsWithShort = productsWithShort.map((p) => ({
              ...p,
              raw: { ...p.raw },
            }));
            linkRows.forEach((row, i) => {
              const raw = productsWithShort[row.index].raw as Record<string, unknown>;
              raw.affiliate_link_short = shorts[i] || "";
            });
            setProducts(productsWithShort);
            pushSaveLog(`Short link OK · ${filled}/${linkRows.length}`, "success");
            if (filled < linkRows.length) {
              pushSaveLog(`Chỉ tạo được ${filled}/${linkRows.length} short link`, "warning");
            }
          }
        } catch (shortErr: any) {
          const msg = String(shortErr?.message || shortErr || "");
          pushSaveLog(
            msg
              ? `Short link lỗi: ${msg.slice(0, 160)}`
              : "Không tạo được short link. Vẫn lưu bằng long_link.",
            "warning"
          );
        }
      } else {
        pushSaveLog("Không có long_link để rút gọn", "warning");
      }

      setSaveProgressPercent(25);

      if (saveUseAiSeo) {
        // ── 2) Gộp id + tên → object (description/hashtags trống) ──
        const workItems = buildProductSeoWorkItems(productsWithShort);
        pushSaveLog(
          `Đã gộp ${workItems.length} object (id + tên · description/hashtags trống)`,
          "info"
        );
        setSaveProgressStatus(t("ChatGPT tạo mô tả & hashtag…") as string);
        setSaveProgressPercent(30);

        // ── 3) ChatGPT: mô tả + 4–6 hashtag SEO Shopee ──
        const seoResults = await generateProductSeoBatch(
          workItems.map((w) => ({ id: w.id, name: w.productName })),
          (p) => {
            const pct = 30 + Math.round((p.done / Math.max(p.total, 1)) * 55);
            setSaveProgressPercent(Math.min(85, pct));
            setSaveProgressStatus(p.message);
            pushSaveLog(p.message, p.level || "info");
          }
        );

        const seoById = new Map(seoResults.map((r) => [r.id, r]));
        productsWithShort = productsWithShort.map((p) => {
          const seo = seoById.get(p.id);
          if (!seo) return p;
          return {
            ...p,
            raw: {
              ...(p.raw || {}),
              description: seo.description,
              hashtags: seo.hashtags,
            },
          };
        });
        setProducts(productsWithShort);
        pushSaveLog(`Đã gắn mô tả + hashtag vào ${seoResults.length} SP`, "success");
      } else {
        pushSaveLog("Bỏ qua AI generate mô tả & hashtag", "info");
        setSaveProgressPercent(85);
      }

      // ── 4) Ghi CSV + IndexedDB ──
      setSaveProgressPercent(90);
      setSaveProgressStatus(t("Đang ghi CSV…") as string);
      pushSaveLog("Đang ghi CSV vào IndexedDB…", "info");

      const csv = productsToFullScrapedCsv(productsWithShort);
      const keywordsText = getKeywordsText().trim();

      await saveScrapeCsvSession({
        name,
        kind: "crawl-project",
        keyword: keywordsText || name,
        marketHost: openMarketHost,
        marketCode: "",
        productCount: productsWithShort.length,
        csv,
        durationMs: 0,
      });
      setSessions(await loadScrapeCsvSessions());

      setSaveProgressPercent(100);
      setSaveProgressStatus(t("Hoàn tất") as string);
      pushSaveLog(`Xong · đã lưu «${name}» · ${productsWithShort.length} SP`, "success");
      setSaveProgressDone(true);
      toast.success(
        t("Đã lưu «{{name}}» · {{count}} SP", { name, count: productsWithShort.length })
      );
    } catch (err: any) {
      const msg = err?.message || t("Lưu project thất bại");
      pushSaveLog(String(msg), "error");
      setSaveProgressStatus(String(msg));
      setSaveProgressDone(true);
      toast.error(msg);
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
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <label className="m-0 text-sm font-semibold text-gray-800" htmlFor="scrape-keyword-draft">
              {t("Từ khóa sản phẩm")}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-gray-600">{t("Gợi ý AI")}</span>
              <Switch
                size="sm"
                dependent
                value={keywordAiSuggest}
                onChange={(v) => persistKeywordAiSuggest(Boolean(v))}
                readOnly={crawling || suggestingKeywords}
              />
            </div>
          </div>
          <div
            className={`min-h-10 max-h-64 overflow-y-auto rounded-lg border bg-white px-2 py-1.5 ${
              crawling || suggestingKeywords
                ? "border-gray-200 opacity-80"
                : "border-gray-300 focus-within:border-teal-400"
            }`}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {keywords.map((kw, index) => {
                const done = doneKeywords.includes(kw);
                const active = activeKeyword === kw;
                return (
                  <span
                    key={`${kw}-${index}`}
                    className={`inline-flex max-w-full items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${
                      done
                        ? "border-teal-300 bg-teal-50 text-teal-800"
                        : active
                          ? "border-amber-300 bg-amber-50 text-amber-900"
                          : "border-gray-200 bg-gray-50 text-gray-700"
                    }`}
                  >
                    <span className="truncate" title={kw}>
                      {kw}
                    </span>
                    <button
                      type="button"
                      disabled={crawling || suggestingKeywords}
                      onClick={() => removeKeywordAt(index)}
                      className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-white/80 hover:text-rose-600 disabled:opacity-40"
                      aria-label={t("Xóa từ khóa") as string}
                    >
                      <HiX className="text-xs" />
                    </button>
                  </span>
                );
              })}
              <input
                id="scrape-keyword-draft"
                type="text"
                value={keywordDraft}
                disabled={crawling || suggestingKeywords}
                autoComplete="off"
                spellCheck={false}
                lang="vi"
                placeholder={
                  keywords.length
                    ? t("Thêm từ khóa… (Enter hoặc ,)")
                    : t("Nhập từ khóa… (Enter hoặc ,)")
                }
                onChange={(e) => {
                  const v = e.target.value;
                  if (v.includes(",")) {
                    const [head, ...rest] = v.split(",");
                    const toAdd = [head, ...rest.slice(0, -1)];
                    const tail = rest[rest.length - 1] ?? "";
                    const parts = toAdd.map((k) => k.trim()).filter(Boolean);
                    if (parts.length) persistKeywords([...keywords, ...parts]);
                    setKeywordDraft(tail);
                    return;
                  }
                  setKeywordDraft(v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitKeywordDraft();
                    return;
                  }
                  if (e.key === "Backspace" && !keywordDraft && keywords.length) {
                    removeKeywordAt(keywords.length - 1);
                  }
                }}
                onBlur={() => {
                  if (keywordDraft.trim()) commitKeywordDraft();
                }}
                className="h-7 min-w-[140px] flex-1 border-0 bg-transparent px-1 text-sm text-gray-800 outline-none disabled:cursor-not-allowed"
              />
              {keywords.length > 0 ? (
                <button
                  type="button"
                  disabled={crawling || suggestingKeywords}
                  onClick={clearKeywords}
                  className="ml-auto inline-flex h-7 shrink-0 items-center rounded-md px-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 hover:text-rose-600 disabled:opacity-40"
                >
                  {t("Clear")}
                </button>
              ) : null}
            </div>
          </div>
          <p className="m-0 mt-1.5 text-xs leading-relaxed text-gray-500">
            {t(
              "Danh sách từ khóa cách nhau bằng dấu phẩy. Enter hoặc «,» để thêm chip. Bật Gợi ý AI + để trống → khi Bắt đầu cào, AI tạo ≥{{n}} từ khóa Shopee rồi gắn thêm. Có sẵn từ khóa thì không gọi AI. F5 vẫn giữ; Clear mới xóa.",
              { n: MIN_AI_KEYWORDS }
            )}
          </p>
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
            disabled={suggestingKeywords}
            onClick={() => void handleStartCrawl()}
            className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg border px-2 text-xs font-bold text-white transition-colors disabled:opacity-70 ${
              crawling
                ? "border-danger-dark bg-danger hover:bg-danger-dark"
                : suggestingKeywords
                  ? "border-teal-600 bg-teal-600"
                  : "border-blue-600 bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {crawling ? (
              <>
                <RiLoader4Line className="mr-1 animate-spin" />
                {t("Dừng")}
              </>
            ) : suggestingKeywords ? (
              <>
                <RiLoader4Line className="mr-1 animate-spin" />
                {t("AI gợi ý…")}
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
                  const productUrl = resolveScrapeProductUrl(row, openMarketHost);
                  return (
                    <tr key={row.id} className={panelListRowClass()}>
                      <td className={`${panelListClasses.td} text-center text-gray-600`}>{stt}</td>
                      <td
                        className={`${panelListClasses.td} max-w-xs truncate font-medium text-gray-800`}
                        title={row.productName}
                      >
                        {productUrl ? (
                          <a
                            href={productUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-700 hover:text-teal-800 hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {row.productName || "—"}
                          </a>
                        ) : (
                          row.productName || "—"
                        )}
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
            {t("Nguồn sản phẩm")}
          </p>
          <select
            value={gioSourceSessionId}
            disabled={gioCrawling}
            onChange={(e) => handleSelectGioSourceSession(e.target.value)}
            className="h-9 w-full rounded-lg border border-gray-300 bg-white px-2 text-xs font-semibold text-gray-800 outline-none focus:border-teal-400 disabled:opacity-50"
            aria-label={t("Chọn Crawl Project đã lưu")}
          >
            <option value="">
              {t("— Theo Crawl Project (live) —")}
            </option>
            {crawlProjectSessions.map((s) => (
              <option key={s.id} value={s.id}>
                {sessionDisplayName(s)} · {s.productCount || 0} SP · {formatSessionTime(s.createdAt)}
              </option>
            ))}
          </select>
          <p className="m-0 mt-1.5 text-10 leading-relaxed text-gray-400">
            {!gioSourceSessionId
              ? t(
                  "Để trống: Bắt đầu cào ở đây chạy Crawl Project + check Giỏ Video (tối đa Budget {{b}}). Nút Crawl Project chỉ cào SP, không check Giỏ Video.",
                  { b: gioBudget }
                )
              : products.length
                ? t("Sẽ cào tối đa {{b}} / {{n}} SP nguồn (Budget).", {
                    b: Math.min(gioBudget, products.length),
                    n: products.length,
                  })
                : t("Project đã chọn chưa load SP — bấm chọn lại hoặc «Xem» CSV.")}
          </p>
        </div>

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
          <p className="m-0 mt-1.5 text-10 leading-relaxed text-gray-400">
            {t(
              "Song song ≤ số CDP đang mở (hiện 1 session từ «Mở Trình duyệt»). CDP không đủ → không generate AI."
            )}
          </p>
        </div>

        <div>
          <p className="m-0 mb-2 text-xs font-bold tracking-wide text-gray-500 uppercase">
            {t("Tiêu chí sắp xếp (lọc lần 2 sau AI)")}
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
          <button
            type="button"
            disabled={gioCrawling || savingGioProject || !gioVideoRows.length}
            onClick={openSaveGioProjectDialog}
            className="inline-flex h-9 flex-1 items-center justify-center rounded-lg border border-green-600 bg-green-600 px-2 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
          >
            {savingGioProject ? <RiLoader4Line className="mr-1 animate-spin" /> : null}
            {t("Lưu project")}
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
          {t(
            "Chưa có dữ liệu. Để trống Nguồn → Bắt đầu cào (chạy Project + Giỏ Video), hoặc chọn Crawl Project đã lưu rồi Bắt đầu cào."
          )}
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
                {pagedGioVideoRows.map((row) => {
                  const originUrl = productUrlFromKey(row.id, openMarketHost);
                  return (
                  <tr key={row.id} className={panelListRowClass()}>
                    <td className={`${panelListClasses.td} text-center text-gray-600`}>
                      {row.stt}
                    </td>
                    <td
                      className={`${panelListClasses.td} max-w-xs truncate font-medium text-gray-800`}
                      title={row.name}
                    >
                      {originUrl ? (
                        <a
                          href={originUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-700 hover:text-teal-800 hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.name || "—"}
                        </a>
                      ) : (
                        row.name || "—"
                      )}
                    </td>
                    <td className={`${panelListClasses.td} text-center text-gray-700`}>
                      {row.similar || "—"}
                    </td>
                    <td className={`${panelListClasses.td} text-center text-gray-700`}>
                      {row.promoted || "—"}
                    </td>
                    <td
                      className={`${panelListClasses.td} text-center ${gioCartClass(
                        row.cartColor
                      )}`}
                    >
                      {collectGioCartLinks(row, openMarketHost).length ? (
                        <button
                          type="button"
                          className="cursor-pointer border-0 bg-transparent p-0 text-inherit underline-offset-2 hover:underline"
                          style={{ font: "inherit" }}
                          title={t("Mở giỏ video trong tab trình duyệt mới") as string}
                          onClick={() => {
                            const ok = openGioVideoCartBrowserTab(row, openMarketHost, t);
                            if (!ok) {
                              toast.warn(
                                t(
                                  "Không mở được tab (popup bị chặn) hoặc chưa có link SP trong giỏ."
                                )
                              );
                            }
                          }}
                        >
                          {row.cartText || "—"}
                        </button>
                      ) : (
                        row.cartText || "—"
                      )}
                    </td>
                    <td
                      className={`${
                        panelListClasses.td
                      } text-center whitespace-nowrap ${gioStatusClass(row.statusColor)}`}
                    >
                      {row.statusText || "—"}
                    </td>
                  </tr>
                  );
                })}
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
    ) : agentOnline === true && gpmOnline === false ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-10 font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
        {t("GPM Login offline")}
      </span>
    ) : agentOnline === true && gpmOnline === true ? (
      <span className="inline-flex items-center gap-1 rounded-full bg-success-light px-2 py-0.5 text-10 font-semibold text-success-dark ring-1 ring-inset ring-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        {t("Online · {{n}} profile", { n: gpmProfiles.length })}
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-10 font-semibold text-gray-500 ring-1 ring-inset ring-gray-200">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gray-400" />
        {t("Đang kiểm tra…")}
      </span>
    );

  const hasOpenaiKey = Boolean(openaiKey.trim());
  const hasGeminiKey = Boolean(geminiKey.trim());
  /** Gateway sẵn sàng chỉ khi đủ Endpoint + API Key + Model. */
  const hasGateway =
    Boolean(gatewayEndpoint.trim()) &&
    Boolean(gatewayApiKey.trim()) &&
    Boolean(gatewayModel.trim());
  const hasAnyAi = hasGateway || hasOpenaiKey || hasGeminiKey;

  const aiReadyIcon = (
    ok: boolean,
    Icon: typeof RiCloudLine,
    label: string
  ) => (
    <span
      className={`inline-flex items-center gap-1 ${
        ok ? "text-success-dark" : "text-gray-400"
      }`}
      title={`${label}: ${ok ? "Sẵn sàng" : "Chưa sẵn sàng"}`}
    >
      <Icon className={`text-sm ${ok ? "text-success" : "text-gray-400"}`} />
      <span className={`font-semibold ${ok ? "text-success-dark" : "text-gray-400"}`}>
        {label}
      </span>
    </span>
  );

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
                  disabled={loadingGpmProfiles}
                  onClick={() => void refreshAgentAndGpm()}
                  className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-400 transition-colors hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
                  title={t("Kiểm tra lại Agent + GPM Login") as string}
                  aria-label={t("Kiểm tra lại Agent + GPM Login") as string}
                >
                  <RiRefreshLine
                    className={`text-12 ${loadingGpmProfiles ? "animate-spin" : ""}`}
                  />
                </button>
              </div>
              <p className="m-0 text-xs leading-relaxed text-gray-500">
                {t("Local Agent · GPM Login · Cào / Xuất CSV")}
                {agentOnline === false ? (
                  <span className="ml-1 text-rose-600">— {t("tải & mở BatDau.bat")}</span>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={openAiKeysDialog}
              className={`inline-flex max-w-full flex-col items-stretch gap-1.5 rounded-xl px-3 py-2 text-left transition-colors ring-1 ring-inset ${
                hasAnyAi
                  ? "bg-success-light/80 ring-success hover:bg-success-light"
                  : "bg-gray-50 ring-gray-200 hover:bg-gray-100"
              }`}
              title={t("Cấu hình AI Keys") as string}
            >
              <span className="flex items-center gap-2">
                <span className="text-xs font-bold text-gray-800">{t("AI Status")}</span>
                <span
                  className={`text-10 font-bold ${
                    hasAnyAi ? "text-success-dark" : "text-gray-500"
                  }`}
                >
                  {hasAnyAi ? t("Sẵn sàng") : t("Chưa cấu hình")}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-10">
                {aiReadyIcon(hasGateway, RiCloudLine, "Gateway")}
                <span className="text-gray-300">·</span>
                {aiReadyIcon(hasOpenaiKey, RiKey2Line, "OpenAI")}
                <span className="text-gray-300">·</span>
                {aiReadyIcon(hasGeminiKey, RiMagicLine, "Gemini")}
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
                      "Tải Agent về máy → mở GPM Login → Mở Trình duyệt → cào / xuất CSV. Trên domain HTTPS: khi Chrome hỏi quyền Local network hãy Allow (localhost web thì không cần)."
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
                  {t("GPM Login")}
                </span>
                <select
                  value={gpmProfileId}
                  onChange={(e) => setGpmProfileId(e.target.value)}
                  disabled={opening || loadingGpmProfiles}
                  className="h-9 min-w-40 max-w-56 text-xs font-semibold rounded-lg border border-bluegray-300 bg-white px-2 text-accent disabled:opacity-50"
                  aria-label={t("Profile GPM Login")}
                >
                  {!gpmProfiles.length ? (
                    <option value="">{t("— Không có profile —")}</option>
                  ) : (
                    gpmProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
              </label>
              <button
                type="button"
                disabled={loadingGpmProfiles || opening}
                onClick={() => void refreshAgentAndGpm()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-bluegray-300 bg-white px-2.5 text-10 font-semibold text-accent shadow-sm transition-colors hover:bg-bluegray-50 disabled:opacity-50"
                title={t("Làm mới Local Agent + profile GPM Login") as string}
              >
                {loadingGpmProfiles ? (
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
                disabled={opening || !gpmProfileId}
                onClick={() => void handleOpenBrowser()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-purple-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-purple-700 disabled:opacity-50"
              >
                {opening ? (
                  <RiLoader4Line className="text-base animate-spin" />
                ) : (
                  <HiPlay className="text-base" />
                )}
                {opening ? t("Đang chờ login…") : t("Mở Trình duyệt")}
              </button>
            </div>
          </div>

          {guideOpen ? (
            <div id="scrape-guide-body" className="space-y-4">
              <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 m-0 p-0 list-none">
                {GUIDE_STEPS.map((item) => {
                  const Icon = item.Icon;
                  const isDownloadStep = item.step === "01";
                  const isGpmLoginStep = item.step === "02";
                  return (
                    <li
                      key={item.step}
                      className={`relative flex min-h-32 flex-col rounded-xl border p-3.5 shadow-sm transition-colors ${
                        isDownloadStep
                          ? "border-teal-300 bg-teal-50/70 hover:border-teal-400 hover:bg-teal-50"
                          : isGpmLoginStep
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
                                : isGpmLoginStep
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
                              : isGpmLoginStep
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
                        {isGpmLoginStep ? (
                          <a
                            href={GPMLOGIN_DOWNLOAD_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="mt-auto inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 text-12 font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700"
                          >
                            <HiDownload className="text-sm" />
                            {t("Tải GPM Login")}
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

      {/* Tabs: form + SP list + danh sách project đã lưu theo từng tab */}
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
            <div className="flex flex-col">
              <div className="flex min-h-96 overflow-hidden border-b border-gray-200">
                <div className="w-80 shrink-0 border-r border-gray-200 p-4 overflow-y-auto">
                  {crawlProjectForm}
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{productListPanel}</div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2 items-center">
                    <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      {t("Danh sách Crawl Project")}
                    </p>
                    <span className="text-10 text-gray-400">
                      {filteredSessions.length}/{crawlProjectSessions.length}
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={!crawlProjectSessions.length}
                    onClick={() => void handleDeleteAll()}
                    className="inline-flex h-8 items-center gap-1 rounded-lg border border-rose-300 bg-rose-50 px-2.5 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-40"
                  >
                    <HiOutlineTrash />
                    {t("Xóa tất cả")}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 items-end">
                  <div>
                    <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">
                      {t("Domain")}
                    </p>
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
                    <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">
                      {t("Năm")}
                    </p>
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
                    <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">
                      {t("Tháng")}
                    </p>
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
                    <p className="m-0 mb-1 text-10 font-semibold text-gray-500 uppercase">
                      {t("Ngày")}
                    </p>
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

                {!crawlProjectSessions.length ? (
                  <PanelListCard>
                    <div className={panelListClasses.empty}>
                      {t("Chưa có Crawl Project. Cào SP → Lưu project.")}
                    </div>
                  </PanelListCard>
                ) : !filteredSessions.length ? (
                  <PanelListCard>
                    <div className={panelListClasses.empty}>
                      {t("Không có phiên khớp bộ lọc.")}
                    </div>
                  </PanelListCard>
                ) : (
                  <>
                    <PanelListCard>
                      <div className="overflow-auto max-h-96">
                        <table className={panelListClasses.table}>
                          <thead className="sticky top-0 z-10">
                            <tr className={panelListClasses.theadTr}>
                              <th className={`${panelListClasses.th} text-left`}>
                                {t("Thời gian")}
                              </th>
                              <th className={`${panelListClasses.th} text-left`}>{t("Tên")}</th>
                              <th className={`${panelListClasses.th} text-left`}>{t("Domain")}</th>
                              <th className={`${panelListClasses.th} text-left`}>
                                {t("Keyword")}
                              </th>
                              <th className={`${panelListClasses.th} text-left`}>{t("SP")}</th>
                              <th className={`${panelListClasses.th} text-left`}>
                                {t("Thực hiện")}
                              </th>
                              <th className={`${panelListClasses.th} text-left`}>{t("ID")}</th>
                              <th className={`${panelListClasses.th} text-left`} />
                            </tr>
                          </thead>
                          <tbody className={panelListClasses.tbody}>
                            {pagedSessions.map((s) => (
                              <tr key={s.id} className={panelListRowClass()}>
                                <td
                                  className={`${panelListClasses.td} whitespace-nowrap text-gray-700`}
                                >
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
                                <td
                                  className={`${panelListClasses.td} font-semibold text-gray-800`}
                                >
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
            </div>
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Crawl Giỏ Video")}>
            <div className="flex flex-col">
              <div className="flex min-h-96 overflow-hidden border-b border-gray-200">
                <div className="w-80 shrink-0 border-r border-gray-200 p-4 overflow-y-auto">
                  {crawlGioVideoForm}
                </div>
                <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{gioVideoListPanel}</div>
              </div>

              <div className="space-y-3 p-4">
                <div className="flex flex-wrap gap-2 justify-between items-center">
                  <div className="flex gap-2 items-center">
                    <p className="m-0 text-xs font-semibold tracking-wide text-gray-500 uppercase">
                      {t("Danh sách Crawl Giỏ Video")}
                    </p>
                    <span className="text-10 text-gray-400">{gioVideoSessions.length}</span>
                  </div>
                </div>

                {!gioVideoSessions.length ? (
                  <PanelListCard>
                    <div className={panelListClasses.empty}>
                      {t(
                        "Chưa có project Giỏ Video. Cào xong → Lưu project trên tab Crawl Giỏ Video."
                      )}
                    </div>
                  </PanelListCard>
                ) : (
                  <PanelListCard>
                    <div className="overflow-auto max-h-96">
                      <table className={panelListClasses.table}>
                        <thead className="sticky top-0 z-10">
                          <tr className={panelListClasses.theadTr}>
                            <th className={`${panelListClasses.th} text-left`}>
                              {t("Thời gian")}
                            </th>
                            <th className={`${panelListClasses.th} text-left`}>{t("Tên")}</th>
                            <th className={`${panelListClasses.th} text-left`}>{t("Domain")}</th>
                            <th className={`${panelListClasses.th} text-left`}>{t("Nguồn")}</th>
                            <th className={`${panelListClasses.th} text-left`}>{t("SP")}</th>
                            <th className={`${panelListClasses.th} text-left`} />
                          </tr>
                        </thead>
                        <tbody className={panelListClasses.tbody}>
                          {gioVideoSessions.map((s) => (
                            <tr key={s.id} className={panelListRowClass()}>
                              <td
                                className={`${panelListClasses.td} whitespace-nowrap text-gray-700`}
                              >
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
                              <td
                                className={`${panelListClasses.td} font-semibold text-gray-800`}
                              >
                                {s.productCount}
                              </td>
                              <td className={panelListClasses.td}>
                                <div className="flex gap-1 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => handleViewGioSession(s)}
                                    className="inline-flex h-7 items-center gap-1 rounded-md border border-teal-200 bg-teal-50 px-2 text-10 font-semibold text-teal-800 hover:bg-teal-100"
                                    title={t("Mở lại bảng Giỏ Video") as string}
                                  >
                                    <HiEye />
                                    {t("Xem")}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      downloadCsvText(
                                        s.csv,
                                        `gio-video-${s.name || "export"}-${s.id}.csv`
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
                )}
              </div>
            </div>
          </TabGroup.Tab>
        </TabGroup>
      </div>

      <Dialog
        isOpen={aiKeysDialogOpen}
        onClose={() => {
          loadAiKeysFromStorage();
          setAiKeysDialogOpen(false);
        }}
        title={t("API Keys")}
        width="480px"
        maxWidth="95vw"
      >
        <Dialog.Body>
          <div className="space-y-4 pt-1">
            <p className="m-0 text-xs text-gray-500">
              {t(
                "Lọc Giỏ Video bằng AI. Ưu tiên Gateway (endpoint + API key, cùng cách call Flow2 như ai-scene-more), không thì OpenAI/Gemini Key. Chỉ lưu trên trình duyệt."
              )}
            </p>
            <div className="space-y-3 rounded-xl border border-teal-200 bg-teal-50/40 px-3 py-3">
              <div>
                <span className="block text-sm font-semibold text-gray-800">
                  {t("Gateway (Endpoint + API Key)")}
                </span>
                <span className="mt-0.5 block text-xs text-gray-500">
                  {t(
                    "VD endpoint: https://flow2.viettheo.site/v1 — API key dạng f2api_… Gọi /api/v1/chatgpt/chat."
                  )}
                </span>
              </div>
              <div>
                <label
                  className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                  htmlFor="scrape-gateway-endpoint"
                >
                  {t("Endpoint")}
                </label>
                <input
                  id="scrape-gateway-endpoint"
                  type="url"
                  value={gatewayEndpoint}
                  onChange={(e) => setGatewayEndpoint(e.target.value)}
                  placeholder="https://flow2.viettheo.site"
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-teal-400"
                />
              </div>
              <div>
                <label
                  className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                  htmlFor="scrape-gateway-api-key"
                >
                  {t("API Key")}
                </label>
                <div className="flex gap-1.5 items-center">
                  <input
                    id="scrape-gateway-api-key"
                    type={gatewayKeyVisible ? "text" : "password"}
                    value={gatewayApiKey}
                    onChange={(e) => setGatewayApiKey(e.target.value)}
                    placeholder="f2api_..."
                    autoComplete="off"
                    spellCheck={false}
                    className="h-10 min-w-0 flex-1 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-teal-400"
                  />
                  <button
                    type="button"
                    onClick={() => setGatewayKeyVisible((v) => !v)}
                    className={aiKeyFieldBtnClass}
                  >
                    {gatewayKeyVisible ? t("Ẩn") : t("Hiện")}
                  </button>
                </div>
              </div>
              <div>
                <label
                  className="m-0 mb-1.5 block text-xs font-semibold text-gray-700"
                  htmlFor="scrape-gateway-model"
                >
                  {t("Model")}
                </label>
                <input
                  id="scrape-gateway-model"
                  type="text"
                  value={gatewayModel}
                  onChange={(e) => setGatewayModel(e.target.value)}
                  placeholder={DEFAULT_GATEWAY_MODEL}
                  autoComplete="off"
                  spellCheck={false}
                  className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-teal-400"
                />
                <span className="mt-1 block text-10 text-gray-500">
                  {t("Bắt buộc để Gateway sẵn sàng. VD: {{model}}", {
                    model: DEFAULT_GATEWAY_MODEL,
                  })}
                </span>
              </div>
            </div>
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
                  onChange={(e) => setOpenaiKey(e.target.value)}
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
                  onChange={(e) => setGeminiKey(e.target.value)}
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
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  loadAiKeysFromStorage();
                  setAiKeysDialogOpen(false);
                }}
                className="inline-flex h-9 items-center justify-center rounded-lg border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                onClick={handleSaveAiKeys}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-success px-4 text-sm font-semibold text-white hover:bg-success-dark"
              >
                {t("Lưu")}
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
            <div className="rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-gray-700">
                  {t("Dùng AI generate mô tả & hashtag")}
                </span>
                <Switch
                  size="sm"
                  dependent
                  value={saveUseAiSeo}
                  onChange={(v) => setSaveUseAiSeo(Boolean(v))}
                />
              </div>
              <p className="m-0 mt-1.5 text-xs leading-relaxed text-gray-500">
                {t(
                  "Nếu chức năng AI được bật thì hệ thống sẽ dựa vào tên sản phẩm mà generate ra mô tả sản phẩm và #hashtags cho sản phẩm đó."
                )}
              </p>
            </div>
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
                {savingProject ? t("Đang lưu…") : t("Lưu")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={gioSaveDialogOpen}
        onClose={() => {
          if (!savingGioProject) setGioSaveDialogOpen(false);
        }}
        title={t("Lưu Project Giỏ Video")}
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
                value={gioSaveProjectName}
                onChange={(e) => setGioSaveProjectName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !savingGioProject) {
                    e.preventDefault();
                    void handleSaveGioProject();
                  }
                }}
                placeholder="Crawl Giỏ Video 1"
                className="h-10 w-full rounded border border-gray-300 px-3 text-sm outline-none focus:border-blue-400"
              />
              <span className="mt-1 block text-xs text-gray-500">
                {t("Lưu riêng danh sách kết quả Giỏ Video (không lẫn Crawl Project).")}
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={savingGioProject}
                onClick={() => setGioSaveDialogOpen(false)}
                className="h-9 rounded-lg bg-gray-600 px-4 text-sm font-bold text-white hover:bg-gray-700 disabled:opacity-50"
              >
                {t("Hủy")}
              </button>
              <button
                type="button"
                disabled={savingGioProject || !gioSaveProjectName.trim()}
                onClick={() => void handleSaveGioProject()}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700 disabled:opacity-50"
              >
                {savingGioProject ? <RiLoader4Line className="animate-spin" /> : null}
                {t("Lưu")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>

      <Dialog
        isOpen={saveProgressOpen}
        onClose={() => {
          if (!savingProject) setSaveProgressOpen(false);
        }}
        title={t("Tiến trình lưu Project")}
        width="600px"
        maxWidth="95vw"
      >
        <Dialog.Body>
          <div className="space-y-4 pt-1">
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">
                  {saveProgressStatus || t("Đang xử lý…")}
                </p>
                <span
                  className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-bold tabular-nums ${
                    saveProgressDone && saveProgressPercent < 100
                      ? "bg-rose-50 text-rose-700"
                      : "bg-teal-50 text-teal-800"
                  }`}
                >
                  {Math.max(0, Math.min(100, saveProgressPercent))}%
                </span>
              </div>
              {/* Progress fill dùng inline style — tránh Tailwind purge / h-full collapse */}
              <div
                className="relative w-full overflow-hidden rounded-full"
                style={{ height: 10, backgroundColor: "#e2e8f0" }}
                role="progressbar"
                aria-valuenow={saveProgressPercent}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.max(2, Math.min(100, saveProgressPercent))}%`,
                    borderRadius: 9999,
                    background:
                      saveProgressDone && saveProgressPercent < 100
                        ? "linear-gradient(90deg,#fb7185,#e11d48)"
                        : "linear-gradient(90deg,#2dd4bf,#0d9488)",
                    transition: "width 280ms ease-out",
                    boxShadow: "0 0 12px rgba(13,148,136,0.35)",
                  }}
                />
              </div>
            </div>

            <div
              className="overflow-hidden rounded-xl"
              style={{
                border: "1px solid #1e293b",
                background: "linear-gradient(180deg, #0b1220 0%, #0f172a 40%, #020617 100%)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06)",
              }}
            >
              <div
                className="flex items-center justify-between gap-2 px-3 py-2"
                style={{
                  borderBottom: "1px solid rgba(51,65,85,0.8)",
                  background: "rgba(15,23,42,0.85)",
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block h-2 w-2 rounded-full ${
                      savingProject ? "animate-pulse bg-teal-400" : "bg-slate-500"
                    }`}
                  />
                  <span
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: "#94a3b8" }}
                  >
                    {t("Nhật ký")}
                  </span>
                </div>
                <span className="text-[11px] tabular-nums" style={{ color: "#64748b" }}>
                  {saveProgressLogs.length} lines
                </span>
              </div>
              <div
                ref={saveLogBoxRef}
                className="max-h-72 min-h-[200px] overflow-y-auto px-3 py-2.5"
                style={{
                  fontFamily:
                    'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                  fontSize: 11.5,
                  lineHeight: 1.65,
                }}
              >
                {saveProgressLogs.length === 0 ? (
                  <div style={{ color: "#64748b" }}>{t("Chờ log…")}</div>
                ) : (
                  saveProgressLogs.map((log) => {
                    const levelColor =
                      log.level === "success"
                        ? "#34d399"
                        : log.level === "warning"
                        ? "#fbbf24"
                        : log.level === "error"
                        ? "#fb7185"
                        : "#38bdf8";
                    const rowBg =
                      log.level === "error"
                        ? "rgba(244,63,94,0.08)"
                        : log.level === "warning"
                        ? "rgba(245,158,11,0.07)"
                        : log.level === "success"
                        ? "rgba(16,185,129,0.06)"
                        : "transparent";
                    return (
                      <div
                        key={log.id}
                        className="mb-0.5 break-words rounded px-1.5 py-0.5"
                        style={{ background: rowBg, color: "#e2e8f0" }}
                      >
                        <span style={{ color: "#64748b" }}>[{log.time}]</span>{" "}
                        <span style={{ color: levelColor, fontWeight: 600 }}>{log.level}:</span>{" "}
                        <span style={{ color: "#f1f5f9" }}>{log.message}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                disabled={savingProject}
                onClick={() => setSaveProgressOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-lg bg-teal-600 px-4 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
              >
                {savingProject ? t("Đang chạy…") : t("Đóng")}
              </button>
            </div>
          </div>
        </Dialog.Body>
      </Dialog>
    </div>
  );
}
