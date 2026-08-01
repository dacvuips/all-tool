/**
 * Web → Local Agent (máy user): lấy 1 trang product list qua GPM Login CDP.
 */

import { agentFetch, probeScrapeAgent, SCRAPE_AGENT_BASE } from "./agent-client";

export type AffiliateProductPageRequest = {
  marketHost: string;
  keyword: string;
  /** 1=liên quan, 2=bán chạy, 3=giá cao→thấp, 4=giá thấp→cao, 5=hoa hồng */
  sortType: number;
  pageOffset: number;
  pageLimit?: number;
  listType?: number;
  /** filter_shop_types: 1=Mall, 4=Yêu thích+, 2=Yêu thích */
  filterShopTypes?: number[];
};

export type AffiliateProductRaw = Record<string, unknown>;

export type AffiliateProductPageResult = {
  ok: true;
  products: AffiliateProductRaw[];
  hasMore: boolean;
  totalCount: number | null;
  keyword: string;
  marketHost: string;
};

export type CdpBridgeStatus = {
  ok: boolean;
  /** Số CDP/session sẵn sàng (hiện tối đa 1 — Mở Trình duyệt). */
  slots: number;
  hasCookies: boolean;
  cdpAlive: boolean;
  agentOnline: boolean;
};

/** Chi tiết Local Agent + CDP/session (cookie hoặc CDP còn sống). */
export async function getCdpBridgeStatus(timeoutMs = 5000): Promise<CdpBridgeStatus> {
  const agent = await probeScrapeAgent(Math.min(2500, timeoutMs));
  if (!agent.online) {
    return {
      ok: false,
      slots: 0,
      hasCookies: false,
      cdpAlive: false,
      agentOnline: false,
    };
  }

  let hasCookies = Boolean(agent.hasCookies);
  let cdpAlive = false;
  try {
    const { res, json } = await agentFetch("/cdp-status", {
      method: "GET",
      timeoutMs,
    });
    if (res.ok && json?.ok) {
      hasCookies = Boolean(json.hasCookies || hasCookies);
      cdpAlive = Boolean(json.cdpAlive || json.connected);
    }
  } catch {
    // Agent online nhưng /cdp-status lỗi — vẫn tin hasCookies từ /status
  }

  const slots = hasCookies || cdpAlive ? 1 : 0;
  return {
    ok: slots > 0,
    slots,
    hasCookies,
    cdpAlive,
    agentOnline: true,
  };
}

/** Kiểm tra Local Agent + đã có cookie session (sau Mở Trình duyệt GPM Login). */
export async function probeCdpBridge(timeoutMs = 5000): Promise<boolean> {
  const status = await getCdpBridgeStatus(timeoutMs);
  return status.ok;
}

function isTransientProductPageError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("navigated or closed") ||
    msg.includes("target closed") ||
    msg.includes("session closed") ||
    msg.includes("websocket") ||
    msg.includes("execution context was destroyed") ||
    msg.includes("cannot find context") ||
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("network") ||
    msg.includes("fetch failed")
  );
}

export async function fetchAffiliateProductPage(
  input: AffiliateProductPageRequest,
  timeoutMs = 90000
): Promise<AffiliateProductPageResult> {
  const agent = await probeScrapeAgent(2500);
  if (!agent.online) {
    throw new Error(
      agent.message ||
        `Chưa thấy Local Agent (${SCRAPE_AGENT_BASE}). Mở Shopee Scrape Agent (BatDau.bat / .exe).`
    );
  }

  const maxAttempts = 3;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { res, json } = await agentFetch("/product-page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs,
        body: JSON.stringify({
          marketHost: input.marketHost,
          keyword: input.keyword,
          sortType: input.sortType,
          pageOffset: input.pageOffset,
          pageLimit: input.pageLimit ?? 20,
          listType: input.listType ?? 0,
          filterShopTypes: input.filterShopTypes || [],
        }),
      });
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.message ||
            "Lấy sản phẩm thất bại. Bấm «Mở Trình duyệt» (GPM Login qua Agent) rồi thử lại."
        );
      }
      return {
        ok: true,
        products: Array.isArray(json.products) ? json.products : [],
        hasMore: Boolean(json.hasMore),
        totalCount: typeof json.totalCount === "number" ? json.totalCount : null,
        keyword: String(json.keyword || input.keyword || ""),
        marketHost: String(json.marketHost || input.marketHost || ""),
      };
    } catch (err: any) {
      const message =
        err?.message || "Hết thời gian chờ. Kiểm tra Agent + GPM Login còn mở và thử lại.";
      lastErr = new Error(message);
      if (!isTransientProductPageError(message) || attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }

  throw lastErr || new Error("Lấy sản phẩm thất bại.");
}

/**
 * Parse % hoa hồng từ API:
 * - "25%" → 25
 * - "28,5%" → 28.5 (dấu phẩy VN)
 * - 0.25 → 25
 */
export function parseCommissionPct(raw: unknown): number {
  if (raw == null || raw === "") return 0;
  const s = String(raw)
    .replace(/%/g, "")
    .trim()
    .replace(/\s/g, "")
    .replace(",", ".");
  const n = Number(s);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n <= 1) return Math.round(n * 10000) / 100;
  return n;
}

/** Giá VND đã chuẩn (sau khi chia ×1000 từ API, hoặc từ CSV đã lưu). */
export function parsePriceVnd(raw: unknown): number {
  const n = Number(String(raw ?? "").replace(/,/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n);
}

const PRICE_VND_NORMALIZED = "__priceVndNormalized";

/** API affiliate trả giá ×1000 — chia về đồng thật cho price / price_min / price_max (idempotent). */
export function normalizeApiPriceFields<T extends Record<string, unknown>>(raw: T): T {
  if ((raw as Record<string, unknown>)[PRICE_VND_NORMALIZED]) return raw;
  const out = { ...raw } as T;
  for (const key of ["price", "price_min", "price_max"] as const) {
    if (out[key] == null || out[key] === "") continue;
    const n = Number(String(out[key]).replace(/,/g, "").trim());
    if (!Number.isFinite(n) || n <= 0) continue;
    (out as Record<string, unknown>)[key] = Math.round(n / 1000);
  }
  (out as Record<string, unknown>)[PRICE_VND_NORMALIZED] = true;
  return out;
}

export function parseSales(raw: unknown): number {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

/** Shopee Mall = official shop (không dùng shopee_verified). */
export function isShopeeMallProduct(row: AffiliateProductRaw, card?: AffiliateProductRaw): boolean {
  const src = card || row;
  return Boolean(
    row.is_official_shop ||
      src.is_official_shop ||
      row.show_official_shop_label ||
      src.show_official_shop_label ||
      row.show_official_shop_label_in_title ||
      src.show_official_shop_label_in_title
  );
}

function asRecord(value: unknown): AffiliateProductRaw | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as AffiliateProductRaw)
    : null;
}

function pickField(row: AffiliateProductRaw, card: AffiliateProductRaw | null, ...keys: string[]) {
  for (const key of keys) {
    const a = row[key];
    if (a != null && a !== "") return a;
    if (card) {
      const b = card[key];
      if (b != null && b !== "") return b;
    }
  }
  return undefined;
}

/** Ưu tiên seller → default → max; bỏ qua "0%" nếu còn rate khác.
 * API thật: seller_commission_rate "11,5%", default_commission_rate "3,5%"
 */
export function pickCommissionPct(row: AffiliateProductRaw, card: AffiliateProductRaw | null): number {
  const candidates = [
    pickField(row, card, "seller_commission_rate"),
    pickField(row, card, "default_commission_rate"),
    pickField(row, card, "max_commission_rate"),
    pickField(row, card, "commission"),
  ];
  for (const c of candidates) {
    const n = parseCommissionPct(c);
    if (n > 0) return n;
  }
  return 0;
}

export function mapRawToScrapeRow(
  row: AffiliateProductRaw,
  index: number
): {
  id: string;
  productName: string;
  commissionPct: number;
  sales: number;
  price: number;
  commissionReceived: number;
  postedAt: number;
  isMall: boolean;
} {
  const card = asRecord(row.batch_item_for_item_card_full);
  const itemId = String(pickField(row, card, "item_id", "itemid") ?? index);
  const shopId = String(pickField(row, card, "shopid", "shop_id") ?? "");
  const commissionPct = pickCommissionPct(row, card);
  const price = parsePriceVnd(pickField(row, card, "price_min", "price", "price_max"));
  const sales = parseSales(pickField(row, card, "historical_sold", "sold", "sold_count"));
  const ctime = Number(pickField(row, card, "ctime"));
  const postedAt = Number.isFinite(ctime) && ctime > 0 ? (ctime < 1e12 ? ctime * 1000 : ctime) : 0;

  return {
    id: `${shopId}-${itemId}`,
    productName: String(pickField(row, card, "name", "product_name") || ""),
    commissionPct,
    sales,
    price,
    commissionReceived: Math.round((price * commissionPct) / 100),
    postedAt,
    isMall: isShopeeMallProduct(row, card || undefined),
  };
}
