/**
 * Mapping Account: phân bổ SP từ Crawl Project / Giỏ Video → username (Quản lý Profile).
 * Mỗi account tối đa 50 SP; phân bổ đều (chênh lệch ≤ 1).
 */

import { getMappingHashtagPool } from "./mapping-hashtag-samples";

export const MAPPING_MAX_PRODUCTS_PER_ACCOUNT = 50;

export type MappingProductRow = {
  itemId: string;
  productLink: string;
  description: string;
  hashtags: string;
};

export type MappingCsvRow = {
  accountName: string;
  videoFileName: string;
  productLink: string;
  contentAndHashtag: string;
};

export type MappingDistributeResult = {
  rows: MappingCsvRow[];
  accountCount: number;
  productCount: number;
  mappedCount: number;
  skippedProducts: number;
  perAccount: Array<{ account: string; count: number }>;
};

function escCsv(value: unknown): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Lấy ngẫu nhiên `count` hashtag không trùng từ pool. */
export function pickRandomHashtags(pool: string[], count = 5): string[] {
  const unique = Array.from(
    new Set(
      (pool || [])
        .map((t) => String(t || "").trim())
        .filter((t) => t.startsWith("#") || t.length > 0)
        .map((t) => (t.startsWith("#") ? t : `#${t}`))
    )
  );
  if (!unique.length) return [];
  const copy = [...unique];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, Math.min(count, copy.length));
}

/**
 * Parse 1 dòng raw từ CSV scrape → field mapping.
 * Ưu tiên product_link; file video = item_id (không kèm .mp4).
 */
export function productRawToMappingRow(raw: Record<string, unknown>): MappingProductRow | null {
  const itemId = String(
    raw.item_id ?? raw.itemid ?? raw.product_id ?? raw.productId ?? ""
  ).trim();
  if (!itemId) return null;

  const productLink = String(
    raw.product_link ||
      raw.affiliate_link_short ||
      raw.long_link ||
      raw.affiliate_link ||
      ""
  ).trim();
  if (!productLink) return null;

  return {
    itemId,
    productLink,
    description: String(raw.description || "").trim(),
    hashtags: String(raw.hashtags || "").trim(),
  };
}

export function buildContentAndHashtag(
  product: MappingProductRow,
  marketHost: string
): string {
  const desc = String(product.description || "").trim();
  const tags = String(product.hashtags || "")
    .trim()
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (desc && tags) return `${desc} ${tags}`.trim();
  if (desc) return desc;
  if (tags) return tags;

  const pool = getMappingHashtagPool(marketHost);
  return pickRandomHashtags(pool, 5).join(" ");
}

/**
 * Phân bổ đều products → accounts.
 * Mỗi account nhận floor(n/m) hoặc ceil(n/m) (chênh ≤ 1), tối đa 50.
 * Nếu SP > accounts×50 → chỉ map accounts×50 SP đầu, phần dư bỏ qua.
 */
export function distributeProductsToAccounts(
  accounts: string[],
  products: MappingProductRow[],
  marketHost: string
): MappingDistributeResult {
  const usernames = Array.from(
    new Set(accounts.map((a) => String(a || "").trim()).filter(Boolean))
  );
  if (!usernames.length) {
    return {
      rows: [],
      accountCount: 0,
      productCount: products.length,
      mappedCount: 0,
      skippedProducts: products.length,
      perAccount: [],
    };
  }

  const maxTotal = usernames.length * MAPPING_MAX_PRODUCTS_PER_ACCOUNT;
  const toMap = products.slice(0, maxTotal);
  const skippedProducts = Math.max(0, products.length - toMap.length);
  const n = toMap.length;
  const m = usernames.length;
  const base = Math.floor(n / m);
  const remainder = n % m;

  const rows: MappingCsvRow[] = [];
  const perAccount: Array<{ account: string; count: number }> = [];
  let cursor = 0;

  for (let i = 0; i < m; i++) {
    const count = Math.min(
      MAPPING_MAX_PRODUCTS_PER_ACCOUNT,
      base + (i < remainder ? 1 : 0)
    );
    const account = usernames[i];
    perAccount.push({ account, count });
    for (let k = 0; k < count; k++) {
      const p = toMap[cursor++];
      if (!p) break;
      rows.push({
        accountName: account,
        videoFileName: p.itemId,
        productLink: p.productLink,
        contentAndHashtag: buildContentAndHashtag(p, marketHost),
      });
    }
  }

  return {
    rows,
    accountCount: usernames.length,
    productCount: products.length,
    mappedCount: rows.length,
    skippedProducts,
    perAccount,
  };
}

/** Header khớp mẫu Mapping (ảnh Excel). */
export const MAPPING_CSV_HEADERS = [
  "Tên Accounts",
  "Tên file video",
  "Link sản phẩm",
  "Nội dung & Hashtag",
] as const;

export function mappingRowsToCsv(rows: MappingCsvRow[]): string {
  const lines = [
    MAPPING_CSV_HEADERS.join(","),
    ...rows.map((r) =>
      [r.accountName, r.videoFileName, r.productLink, r.contentAndHashtag]
        .map(escCsv)
        .join(",")
    ),
  ];
  return lines.join("\n");
}
