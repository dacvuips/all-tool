/**
 * Parse shop_id / item_id từ link sản phẩm Shopee hoặc productId.
 * Dùng để gắn affiliate product (shot) vào createPost.
 */
export type ParsedShopeeProduct = {
  shopId: string;
  itemId: string;
};

const LINK_PATTERNS = [
  /i\.(\d+)\.(\d+)/i,
  /\/product\/(\d+)\/(\d+)/i,
  /\/i\/(\d+)\/(\d+)/i,
];

/** shop_id.item_id | shop_id:item_id | shop_id_item_id | shop_id-item_id */
const ID_PATTERNS = [/^(\d+)[.:\-_](\d+)$/, /^i\.(\d+)\.(\d+)$/i];

export function parseShopeeProductLink(link: string): ParsedShopeeProduct | null {
  const raw = String(link || "").trim();
  if (!raw) return null;
  for (const re of LINK_PATTERNS) {
    const m = raw.match(re);
    if (m) return { shopId: m[1], itemId: m[2] };
  }
  return null;
}

export function parseShopeeProductId(productId: string): ParsedShopeeProduct | null {
  const raw = String(productId || "").trim();
  if (!raw) return null;
  for (const re of ID_PATTERNS) {
    const m = raw.match(re);
    if (m) return { shopId: m[1], itemId: m[2] };
  }
  // Thử parse như link nếu dán nhầm productId
  return parseShopeeProductLink(raw);
}

export type AffiliateProductRef = {
  item_id: number;
  shop_id: number;
  source_tab: number;
};

function toRef(p: ParsedShopeeProduct): AffiliateProductRef {
  return {
    shop_id: Number(p.shopId),
    item_id: Number(p.itemId),
    source_tab: 1, // affiliate / gắn sản phẩm trong video
  };
}

export function productsFromLinks(
  links: string | string[]
): AffiliateProductRef[] {
  const lines = Array.isArray(links)
    ? links
    : String(links || "")
        .split(/[\n|,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out: AffiliateProductRef[] = [];
  const seen = new Set<string>();
  for (const line of lines) {
    const p = parseShopeeProductLink(line) || parseShopeeProductId(line);
    if (!p) continue;
    const key = `${p.shopId}:${p.itemId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(toRef(p));
  }
  return out.slice(0, 6);
}

/**
 * Gộp productLink + productId → danh sách affiliate products (tối đa 6).
 */
export function resolveAffiliateProducts(params: {
  productLink?: string;
  productId?: string;
}): AffiliateProductRef[] {
  const fromLink = productsFromLinks(params.productLink || "");
  if (fromLink.length) return fromLink;

  const fromId = parseShopeeProductId(params.productId || "");
  if (fromId) return [toRef(fromId)];

  return [];
}
