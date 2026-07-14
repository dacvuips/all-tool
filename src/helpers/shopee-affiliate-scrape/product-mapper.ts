/**
 * Map item API Shopee Affiliate → bản ghi phẳng (port từ aShopee inject.js).
 */

import { ShopeeAffiliateMarket } from "./domains";

export type ScrapedAffiliateProduct = {
  stt: number;
  item_id: string;
  shop_id: string;
  product_name: string;
  shop_name: string;
  price_min: string | number;
  price_max: string | number;
  commission: string;
  product_link: string;
  affiliate_link: string;
  affiliate_link_short: string;
  image_url: string;
  default_commission_rate: string;
  seller_commission_rate: string;
  max_commission_rate: string;
  currency: string;
  sold: string | number;
  rating_star: string | number;
};

export const CSV_COLUMNS: Array<{ key: keyof ScrapedAffiliateProduct | string; header: string }> = [
  { key: "stt", header: "STT" },
  { key: "item_id", header: "Mã sản phẩm" },
  { key: "shop_id", header: "Mã shop" },
  { key: "product_name", header: "Tên sản phẩm" },
  { key: "shop_name", header: "Tên shop" },
  { key: "price_min", header: "Giá thấp nhất (VNĐ)" },
  { key: "price_max", header: "Giá cao nhất (VNĐ)" },
  { key: "max_commission_rate", header: "Hoa hồng tối đa" },
  { key: "seller_commission_rate", header: "Hoa hồng shop" },
  { key: "default_commission_rate", header: "Hoa hồng mặc định" },
  { key: "product_link", header: "Link sản phẩm" },
  { key: "affiliate_link", header: "Link affiliate" },
  { key: "affiliate_link_short", header: "Link affiliate shot" },
  { key: "image_url", header: "Ảnh" },
  { key: "currency", header: "Tiền tệ" },
  { key: "sold", header: "Đã bán" },
  { key: "rating_star", header: "Đánh giá sao" },
];

function formatPrice(value: unknown): string | number {
  if (value == null || value === "") return "";
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return Math.round(num / 100000);
}

function formatImageUrl(imageId: unknown, market: ShopeeAffiliateMarket): string {
  if (!imageId) return "";
  const s = String(imageId);
  if (s.startsWith("http")) return s;
  return `${market.imageCdn}${s}`;
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

export function flattenProduct(
  item: any,
  index: number,
  pageOffset: number,
  market: ShopeeAffiliateMarket
): ScrapedAffiliateProduct {
  const card = item.batch_item_for_item_card_full || {};
  const rating = card.item_rating || {};
  const shopId = String(card.shopid || "");
  const itemId = String(item.item_id || card.itemid || "");

  return {
    stt: pageOffset + index + 1,
    item_id: itemId,
    shop_id: shopId,
    product_name: card.name || "",
    shop_name: card.shop_name || "",
    price_min: formatPrice(card.price_min),
    price_max: formatPrice(card.price_max),
    commission:
      String(item.max_commission_rate || item.seller_commission_rate || item.default_commission_rate || ""),
    product_link:
      item.product_link ||
      (shopId && itemId ? `https://${market.mallHost}/product/${shopId}/${itemId}` : ""),
    affiliate_link: item.long_link || "",
    affiliate_link_short: "",
    image_url: formatImageUrl(card.image, market),
    default_commission_rate: String(item.default_commission_rate || ""),
    seller_commission_rate: String(item.seller_commission_rate || ""),
    max_commission_rate: String(item.max_commission_rate || ""),
    currency: card.currency || "VND",
    sold: card.sold ?? "",
    rating_star: rating.rating_star ?? "",
  };
}

function escapeCsv(value: unknown): string {
  const text = value == null ? "" : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function productsToCsv(products: ScrapedAffiliateProduct[]): string {
  const lines = [CSV_COLUMNS.map((col) => escapeCsv(col.header)).join(",")];
  for (const row of products) {
    lines.push(
      CSV_COLUMNS.map((col) => escapeCsv((row as Record<string, unknown>)[col.key])).join(",")
    );
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
    productId: String(p.item_id || ""),
    shopId: String(p.shop_id || ""),
    productName: String(p.product_name || ""),
    shopName: String(p.shop_name || ""),
    productLink: String(p.product_link || ""),
    affiliateLink: String(p.affiliate_link_short || p.affiliate_link || ""),
    commission: String(
      p.commission || p.max_commission_rate || p.seller_commission_rate || p.default_commission_rate || ""
    ),
    imageUrl: String(p.image_url || ""),
  }));
}
