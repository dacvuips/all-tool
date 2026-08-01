/**
 * Crawl Giỏ Video → Local Agent DETAIL + AI Worker (OpenAI/Gemini) lọc theo tên.
 * Không dùng mall image-search ( PeeCrawl fast-path đã bỏ theo yêu cầu ).
 */

import { agentFetch, probeScrapeAgent, SCRAPE_AGENT_BASE } from "./agent-client";

/** 1 SP trong similar_product_offers.list (API thật Affiliate DETAIL). */
export type SimilarOfferItem = {
  key: string;
  shopId: string;
  itemId: string;
  name: string;
  productLink: string;
  imageId: string;
  commissionPct: number;
  commissionValue: number;
  price: number;
  historicalSold: number;
  sold: number;
  /** unix seconds */
  ctime: number;
};

export type AffiliateProductDetailResult = {
  ok: true;
  marketHost: string;
  itemId: string;
  shopId: string;
  name: string;
  imageUrl: string;
  similarCount: number;
  /** Keys `shopId-itemId` (URL /product/shop/item), fallback itemId */
  similarItemIds: string[];
  /** Similar đầy đủ để sort / xuất giỏ */
  similars: SimilarOfferItem[];
  /** data.affiliate_promoted_last_7days */
  promoted7days: string;
  raw?: unknown;
};

export type AffiliateImageSearchResult = {
  ok: true;
  itemIds: string[];
  httpCode: number;
  pagesFetched: number;
};

export type GioSortField =
  | "hoa_hong"
  | "tien_hoa_hong"
  | "tong_da_ban"
  | "ban_gan_day"
  | "ngay_dang";

export type GioSortDirection = "none" | "desc" | "asc";

export type GioSortRow = { field: GioSortField; direction: GioSortDirection };

function ensureAgentOnline(agent: { online: boolean; message?: string }) {
  if (!agent.online) {
    throw new Error(
      agent.message ||
        `Chưa thấy Local Agent (${SCRAPE_AGENT_BASE}). Mở Shopee Scrape Agent (BatDau.bat / .exe).`
    );
  }
}

function mapSimilarFromJson(raw: unknown): SimilarOfferItem | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const key = String(o.key || "").trim();
  const itemId = String(o.itemId || o.item_id || "").trim();
  if (!key && !itemId) return null;
  const shopId = String(o.shopId || o.shop_id || "").trim();
  const resolvedKey = key || (shopId && itemId ? `${shopId}-${itemId}` : itemId);
  return {
    key: resolvedKey,
    shopId,
    itemId: itemId || resolvedKey.split("-").pop() || "",
    name: String(o.name || ""),
    productLink: String(o.productLink || o.product_link || ""),
    imageId: String(o.imageId || o.image || ""),
    commissionPct: Number(o.commissionPct) || 0,
    commissionValue: Number(o.commissionValue) || 0,
    price: Number(o.price) || 0,
    historicalSold: Number(o.historicalSold ?? o.historical_sold) || 0,
    sold: Number(o.sold) || 0,
    ctime: Number(o.ctime) || 0,
  };
}

/** Format QBá 7 ngày (affiliate_promoted_last_7days) cho UI. */
export function formatPromoted7days(raw: string | number | undefined | null): string {
  if (raw == null || raw === "" || raw === "—") return "—";
  const n = Number(String(raw).replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(n)) return String(raw);
  return Math.round(n).toLocaleString("vi-VN");
}

function sortMetric(item: SimilarOfferItem, field: GioSortField): number {
  switch (field) {
    case "hoa_hong":
      return item.commissionPct;
    case "tien_hoa_hong":
      return item.commissionValue;
    case "tong_da_ban":
      return item.historicalSold;
    case "ban_gan_day":
      return item.sold;
    case "ngay_dang":
      return item.ctime;
    default:
      return 0;
  }
}

/**
 * Sắp xếp similar theo tối đa 3 tiêu chí UI (PeeCrawl tab2_data_sort).
 * direction "none" → bỏ qua tiêu chí đó.
 */
export function sortSimilarOffers(
  items: SimilarOfferItem[],
  sortRows: GioSortRow[]
): SimilarOfferItem[] {
  const active = (sortRows || []).filter((r) => r && r.direction && r.direction !== "none");
  if (!active.length) return [...items];
  return [...items].sort((a, b) => {
    for (const row of active) {
      const av = sortMetric(a, row.field);
      const bv = sortMetric(b, row.field);
      if (av === bv) continue;
      return row.direction === "asc" ? av - bv : bv - av;
    }
    return 0;
  });
}

/**
 * PeeCrawl `compute_overlap`: giao itemid mall image-search ∩ similar DETAIL.
 * Giữ thứ tự xuất hiện trong image-search; loại SP gốc.
 * Chỉ trả similar có trong DETAIL (có HH% / đã bán để sort) — không append SP lạ từ mall.
 */
export function computeImageSearchOverlap(
  detailSimilars: SimilarOfferItem[],
  imageKeys: string[],
  excludeKey: string,
  excludeItemId: string
): SimilarOfferItem[] {
  const byItemId = new Map<string, SimilarOfferItem>();
  const byKey = new Map<string, SimilarOfferItem>();
  for (const s of detailSimilars) {
    if (!s?.key) continue;
    if (s.key === excludeKey || s.itemId === excludeItemId) continue;
    byKey.set(s.key, s);
    if (s.itemId) byItemId.set(s.itemId, s);
  }

  const out: SimilarOfferItem[] = [];
  const seen = new Set<string>();
  for (const raw of imageKeys) {
    const key = String(raw || "").trim();
    if (!key || key === excludeKey || key === excludeItemId) continue;
    const hit =
      byKey.get(key) ||
      byItemId.get(key) ||
      (() => {
        const parts = key.split("-");
        const itemOnly = parts.length >= 2 ? parts[parts.length - 1] : "";
        return itemOnly ? byItemId.get(itemOnly) : undefined;
      })();
    if (!hit || seen.has(hit.key)) continue;
    seen.add(hit.key);
    out.push(hit);
  }
  return out;
}

/**
 * PeeCrawl `apply_final_video_filter` (lọc lần 2):
 * sort theo UI → selected_ids = [SP gốc] + match.
 * Không cắt số lượng: mall ∩ similar đã là tập lọc sẵn.
 */
export function applyFinalVideoFilter(
  matches: SimilarOfferItem[],
  sortRows: GioSortRow[],
  sourceKey: string
): {
  cart: SimilarOfferItem[];
  selectedIds: string[];
} {
  const cart = sortSimilarOffers(matches, sortRows);
  const src = String(sourceKey || "").trim();
  const selectedIds = src
    ? [src, ...cart.map((s) => s.key).filter((k) => k && k !== src)]
    : cart.map((s) => s.key);
  return { cart, selectedIds };
}

/**
 * PeeCrawl Tab2 không GPT:
 * ① Lọc lần 1 = mall ∩ similar (fail/empty → không lấy similar, giống AI fallback giỏ≈1)
 * ② Lọc lần 2 = sort theo UI + prepend SP gốc (không cắt)
 */
export function selectVideoCartWithoutAi(
  detailSimilars: SimilarOfferItem[],
  imageKeys: string[],
  sourceKey: string,
  excludeItemId: string,
  sortRows: GioSortRow[],
  /** PeeCrawl: ≥N itemid trùng mới dùng overlap. Không AI → N=1. */
  minOverlap = 1
): {
  cart: SimilarOfferItem[];
  selectedIds: string[];
  source: "overlap" | "source_only";
  overlapCount: number;
} {
  const excludeKey = String(sourceKey || "").trim();
  const pool = detailSimilars.filter(
    (s) => s?.key && s.key !== excludeKey && s.itemId !== excludeItemId
  );
  const overlap = computeImageSearchOverlap(pool, imageKeys, excludeKey, excludeItemId);

  // Không GPT: không đủ overlap → reject similar (PeeCrawl AI-fail ≈ giỏ chỉ gốc)
  const matches = overlap.length >= minOverlap ? overlap : [];
  const { cart, selectedIds } = applyFinalVideoFilter(matches, sortRows, excludeKey);

  return {
    cart,
    selectedIds,
    source: matches.length > 0 ? "overlap" : "source_only",
    overlapCount: overlap.length,
  };
}

/** GET affiliate `/api/v3/offer/product?item_id=` qua Agent CDP. */
export async function fetchAffiliateProductDetail(
  input: { marketHost: string; itemId: string; shopId?: string },
  timeoutMs = 90000
): Promise<AffiliateProductDetailResult> {
  const agent = await probeScrapeAgent(2500);
  ensureAgentOnline(agent);

  const maxAttempts = 3;
  let lastErr: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const { res, json } = await agentFetch("/product-detail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs,
        body: JSON.stringify({
          marketHost: input.marketHost,
          itemId: input.itemId,
          shopId: input.shopId,
        }),
      });
      if (!res.ok || !json?.ok) {
        throw new Error(
          json?.message ||
            "Lấy chi tiết SP thất bại. Bấm «Mở Trình duyệt» (GPM Login) rồi thử lại."
        );
      }
      const similars: SimilarOfferItem[] = Array.isArray(json.similars)
        ? json.similars.map(mapSimilarFromJson).filter((x): x is SimilarOfferItem => !!x)
        : [];
      const similarItemIds = similars.length
        ? similars.map((s) => s.key)
        : Array.isArray(json.similarItemIds)
          ? json.similarItemIds.map((id: unknown) => String(id))
          : [];
      return {
        ok: true,
        marketHost: String(json.marketHost || input.marketHost || ""),
        itemId: String(json.itemId || input.itemId || ""),
        shopId: String(json.shopId || ""),
        name: String(json.name || ""),
        imageUrl: String(json.imageUrl || ""),
        similarCount: Number(json.similarCount) || similarItemIds.length,
        similarItemIds,
        similars,
        promoted7days: String(json.promoted7days || "—"),
        raw: json.raw,
      };
    } catch (err: any) {
      const message = String(err?.message || err || "");
      lastErr = new Error(message || "Lấy chi tiết SP thất bại.");
      const transient =
        /navigated or closed|target closed|session closed|websocket|execution context|econnreset|econnrefused|fetch failed/i.test(
          message
        );
      if (!transient || attempt >= maxAttempts) break;
      await new Promise((r) => setTimeout(r, 700 * attempt));
    }
  }

  throw lastErr || new Error("Lấy chi tiết SP thất bại.");
}

/** PeeCrawl fast-path: mall image_search theo ảnh SP gốc. */
export async function searchSimilarByImage(
  input: {
    marketHost: string;
    imageUrl: string;
    excludeItemId?: string;
    maxPages?: number;
  },
  timeoutMs = 120000
): Promise<AffiliateImageSearchResult> {
  const agent = await probeScrapeAgent(2500);
  ensureAgentOnline(agent);
  const { res, json } = await agentFetch("/image-search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    timeoutMs,
    body: JSON.stringify({
      marketHost: input.marketHost,
      imageUrl: input.imageUrl,
      excludeItemId: input.excludeItemId,
      maxPages: input.maxPages ?? 1,
    }),
  });
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || "Image-search thất bại.");
  }
  return {
    ok: true,
    itemIds: Array.isArray(json.itemIds) ? json.itemIds.map((id: unknown) => String(id)) : [],
    httpCode: Number(json.httpCode) || 0,
    pagesFetched: Number(json.pagesFetched) || 0,
  };
}

/** shopId-itemId → { shopId, itemId } */
export function parseShopItemFromRowId(rowId: string): { shopId: string; itemId: string } {
  const s = String(rowId || "").trim();
  if (!s) return { shopId: "", itemId: "" };
  const parts = s.split("-");
  if (parts.length >= 2) {
    return {
      shopId: parts.slice(0, -1).join("-"),
      itemId: parts[parts.length - 1],
    };
  }
  return { shopId: "", itemId: s };
}

/** @deprecated dùng parseShopItemFromRowId */
export function parseItemIdFromRowId(rowId: string): string {
  return parseShopItemFromRowId(rowId).itemId;
}

export function pickImageUrlFromRaw(raw: Record<string, unknown> | undefined): string {
  if (!raw) return "";
  const card =
    raw.batch_item_for_item_card_full &&
    typeof raw.batch_item_for_item_card_full === "object" &&
    !Array.isArray(raw.batch_item_for_item_card_full)
      ? (raw.batch_item_for_item_card_full as Record<string, unknown>)
      : null;
  const direct = raw.image_url || raw.image || card?.image;
  if (direct == null || direct === "") return "";
  const s = String(direct).trim();
  if (!s) return "";
  if (s.startsWith("http")) return s;
  return `https://down-vn.img.susercontent.com/file/${s}`;
}
