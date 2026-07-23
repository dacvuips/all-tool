/**
 * Tạo session CSV từ products (không hàng đợi extension).
 */

import { productsToCsv, ScrapedAffiliateProduct, toImportRows } from "./product-mapper";

export type ExtensionPushSession = {
  id: string;
  createdAt: number;
  keyword: string;
  marketHost: string;
  marketCode: string;
  productCount: number;
  csv: string;
  durationMs: number;
  importRows: ReturnType<typeof toImportRows>;
};

let lastMarketHost = "affiliate.shopee.vn";

export function getLastMarketHost() {
  return lastMarketHost;
}

export function setLastMarketHost(host: string) {
  const h = String(host || "").trim();
  if (h) lastMarketHost = h;
}

/** Build session CSV — client lưu IndexedDB trực tiếp. */
export function buildCsvSession(input: {
  products: ScrapedAffiliateProduct[];
  keyword?: string;
  marketHost?: string;
  marketCode?: string;
  durationMs?: number;
  csv?: string;
}): ExtensionPushSession {
  const products = Array.isArray(input.products) ? input.products : [];
  if (!products.length) {
    throw new Error("Không có sản phẩm để gửi");
  }
  const csv = input.csv?.trim() ? input.csv : "\uFEFF" + productsToCsv(products);
  const marketHost = String(input.marketHost || lastMarketHost || "");
  if (marketHost) lastMarketHost = marketHost;
  return {
    id: `scrape-csv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: Date.now(),
    keyword: String(input.keyword || ""),
    marketHost,
    marketCode: String(input.marketCode || ""),
    productCount: products.length,
    csv,
    durationMs: Math.max(0, Number(input.durationMs) || 0),
    importRows: toImportRows(products),
  };
}
