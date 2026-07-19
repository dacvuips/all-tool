/**
 * Parse shop_id / item_id từ link sản phẩm Shopee.
 */
export type ParsedShopeeProduct = {
  shopId: string;
  itemId: string;
};

const PATTERNS = [
  /i\.(\d+)\.(\d+)/i,
  /\/product\/(\d+)\/(\d+)/i,
  /\/i\/(\d+)\/(\d+)/i,
];

export function parseShopeeProductLink(link: string): ParsedShopeeProduct | null {
  const raw = String(link || "").trim();
  if (!raw) return null;
  for (const re of PATTERNS) {
    const m = raw.match(re);
    if (m) return { shopId: m[1], itemId: m[2] };
  }
  return null;
}

export function productsFromLinks(
  links: string | string[]
): Array<{
  item_id: number;
  shop_id: number;
  source_tab: number;
}> {
  const lines = Array.isArray(links)
    ? links
    : String(links || "")
        .split(/[\n|]+/)
        .map((s) => s.trim())
        .filter(Boolean);
  const out: Array<{ item_id: number; shop_id: number; source_tab: number }> = [];
  for (const line of lines) {
    const p = parseShopeeProductLink(line);
    if (!p) continue;
    out.push({
      shop_id: Number(p.shopId),
      item_id: Number(p.itemId),
      source_tab: 3,
    });
  }
  return out.slice(0, 6);
}
