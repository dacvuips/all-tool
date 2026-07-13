/**
 * Mở Chrome Affiliate + hàng đợi CSV do extension gửi (để web sync vào IndexedDB).
 */

import { openNormalChrome } from "./open-chrome";
import { defaultOfferUrl } from "./domains";
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

let pendingSessions: ExtensionPushSession[] = [];
let lastMarketHost = "affiliate.shopee.vn";

export function getLastMarketHost() {
  return lastMarketHost;
}

export async function openAffiliateBrowser(marketHost?: string): Promise<{ marketHost: string; offerUrl: string }> {
  const host = String(marketHost || lastMarketHost || "affiliate.shopee.vn").trim();
  lastMarketHost = host;
  const offerUrl = defaultOfferUrl(host);
  await openNormalChrome({ startUrl: offerUrl });
  return { marketHost: host, offerUrl };
}

export function pushExtensionCsv(input: {
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
  const csv = input.csv?.trim()
    ? input.csv
    : "\uFEFF" + productsToCsv(products);
  const marketHost = String(input.marketHost || lastMarketHost || "");
  if (marketHost) lastMarketHost = marketHost;
  const session: ExtensionPushSession = {
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
  pendingSessions = [session, ...pendingSessions].slice(0, 100);
  return session;
}

/** Web poll: lấy phiên mới chưa ack (theo id đã biết phía client). */
export function listPendingExtensionSessions(knownIds: string[] = []): ExtensionPushSession[] {
  const known = new Set(knownIds);
  return pendingSessions.filter((s) => !known.has(s.id));
}

export function listAllExtensionSessions(): ExtensionPushSession[] {
  return [...pendingSessions];
}

export function ackExtensionSessions(ids: string[]): number {
  const set = new Set(ids);
  const before = pendingSessions.length;
  pendingSessions = pendingSessions.filter((s) => !set.has(s.id));
  return before - pendingSessions.length;
}
