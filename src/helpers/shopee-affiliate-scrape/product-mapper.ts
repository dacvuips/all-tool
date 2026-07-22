/**
 * Map item API Shopee Affiliate → bản ghi phẳng (port từ aShopee inject.js).
 * CSV: header = tên field gốc (name, seller_commission_rate, …).
 */

import { ShopeeAffiliateMarket } from "./domains";

/** Bản ghi phẳng — giữ nguyên tên field từ API (+ vài field bổ sung). */
export type ScrapedAffiliateProduct = Record<string, unknown>;

/**
 * Thứ tự cột ưu tiên khi xuất CSV.
 * Các field còn lại (nếu có) gắn thêm theo thứ tự xuất hiện.
 */
export const PREFERRED_CSV_KEYS: string[] = [
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
  "images",
  "currency",
  "price",
  "price_min",
  "price_max",
  "price_before_discount",
  "price_min_before_discount",
  "price_max_before_discount",
  "hidden_price_display",
  "discount",
  "show_discount",
  "raw_discount",
  "has_lowest_price_guarantee",
  "stock",
  "status",
  "item_status",
  "ctime",
  "sold",
  "sold_text",
  "historical_sold",
  "historical_sold_text",
  "liked",
  "liked_count",
  "view_count",
  "catid",
  "brand",
  "cmt_count",
  "flag",
  "cb_option",
  "item_rating",
  "tier_variations",
  "video_info_list",
  "label_ids",
  "shop_rating",
  "shop_location",
  "is_free_sample",
  "is_refundable_sample",
  "is_seller_invited",
  "is_on_flash_sale",
  "is_official_shop",
  "shopee_verified",
  "show_shopee_verified_label",
  "show_official_shop_label",
  "show_official_shop_label_in_title",
  "show_free_shipping",
  "can_use_cod",
  "is_preferred_plus_seller",
  "is_adult",
  "is_mart",
  "item_type",
  "badge_icon_type",
  "offer_card_type",
  "invited_campaign_offer_card",
  "promotion_vouchers",
  "trace",
  "size_chart",
  "pack_size",
  "reference_item_id",
  "transparent_background_image",
  "coin_earn_label",
  "preview_info",
  "coin_info",
  "exclusive_price_info",
  "can_use_bundle_deal",
  "bundle_deal_info",
  "bundle_deal_id",
  "is_group_buy_item",
  "has_group_buy_stock",
  "group_buy_info",
  "welcome_package_type",
  "welcome_package_info",
  "add_on_deal_info",
  "can_use_wholesale",
  "has_model_with_available_shopee_stock",
  "voucher_info",
  "spl_installment_tenure",
  "is_live_streaming_price",
  "deep_discount_skin",
  "overlay_images",
  "optimized_names",
  "live_stream_session",
  "is_cc_installment_payment_eligible",
  "is_non_cc_installment_payment_eligible",
  "is_category_failed",
];

/** @deprecated Dùng PREFERRED_CSV_KEYS — giữ export để tương thích. */
export const CSV_COLUMNS: Array<{ key: string; header: string }> = PREFERRED_CSV_KEYS.map(
  (key) => ({ key, header: key })
);

function formatImageUrl(imageId: unknown, market: ShopeeAffiliateMarket): string {
  if (!imageId) return "";
  const s = String(imageId);
  if (s.startsWith("http")) return s;
  return `${market.imageCdn}${s}`;
}

function serializeCsvCell(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export function extractList(payload: any): any[] {
  const data = payload?.data || payload;
  if (Array.isArray(data?.list)) return data.list;
  if (Array.isArray(data?.products)) return data.products;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data)) return data;
  return [];
}

export function extractTotal(payload: any): number | null {
  const data = payload?.data || payload;
  const candidates = [
    data?.total_count,
    data?.total,
    data?.page_info?.total,
    data?.pagination?.total,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && value >= 0) return value;
  }
  return null;
}

/**
 * Gộp field top-level + batch_item_for_item_card_full (giữ nguyên tên field).
 * Object/array giữ nguyên — serialize lúc ghi CSV.
 */
export function flattenProduct(
  item: any,
  index: number,
  pageOffset: number,
  market: ShopeeAffiliateMarket
): ScrapedAffiliateProduct {
  const card =
    item?.batch_item_for_item_card_full && typeof item.batch_item_for_item_card_full === "object"
      ? item.batch_item_for_item_card_full
      : {};
  const shopId = String(card.shopid || "");
  const itemId = String(item?.item_id || card.itemid || "");

  const row: ScrapedAffiliateProduct = {
    stt: pageOffset + index + 1,
  };

  if (item && typeof item === "object") {
    for (const [key, value] of Object.entries(item)) {
      if (key === "batch_item_for_item_card_full") continue;
      row[key] = value ?? "";
    }
  }

  for (const [key, value] of Object.entries(card)) {
    row[key] = value ?? "";
  }

  if (!row.product_link && shopId && itemId) {
    row.product_link = `https://${market.mallHost}/product/${shopId}/${itemId}`;
  }

  // Field bổ sung (không có trong API raw)
  row.image_url = formatImageUrl(card.image, market);
  row.affiliate_link_short = "";

  return row;
}

function escapeCsv(value: unknown): string {
  const text = serializeCsvCell(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Gom key từ mọi dòng: preferred trước, phần còn lại theo thứ tự xuất hiện. */
export function collectCsvKeys(products: ScrapedAffiliateProduct[]): string[] {
  const seen = new Set<string>();
  for (const product of products) {
    for (const key of Object.keys(product || {})) {
      seen.add(key);
    }
  }
  const preferred = PREFERRED_CSV_KEYS.filter((key) => seen.has(key));
  const preferredSet = new Set(preferred);
  const rest: string[] = [];
  for (const product of products) {
    for (const key of Object.keys(product || {})) {
      if (!preferredSet.has(key) && !rest.includes(key)) rest.push(key);
    }
  }
  return [...preferred, ...rest];
}

export function productsToCsv(products: ScrapedAffiliateProduct[]): string {
  const keys = collectCsvKeys(products);
  const lines = [keys.map((key) => escapeCsv(key)).join(",")];
  for (const row of products) {
    lines.push(keys.map((key) => escapeCsv(row?.[key])).join(","));
  }
  return lines.join("\r\n");
}

/** Shape gọn để import vào video-affiliate-plus. */
export type ScrapeImportRow = {
  productId: string;
  shopId: string;
  productName: string;
  shopName: string;
  productLink: string;
  affiliateLink: string;
  commission: string;
  imageUrl: string;
};

export function toImportRows(products: ScrapedAffiliateProduct[]): ScrapeImportRow[] {
  return products.map((p) => ({
    productId: String(p.item_id || p.itemid || ""),
    shopId: String(p.shopid || p.shop_id || ""),
    productName: String(p.name || p.product_name || ""),
    shopName: String(p.shop_name || ""),
    productLink: String(p.product_link || ""),
    affiliateLink: String(p.affiliate_link_short || p.long_link || p.affiliate_link || ""),
    commission: String(
      p.seller_commission_rate ||
        p.max_commission_rate ||
        p.default_commission_rate ||
        p.commission ||
        ""
    ),
    imageUrl: String(p.image_url || p.image || ""),
  }));
}
