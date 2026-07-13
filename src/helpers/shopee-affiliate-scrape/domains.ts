/**
 * Domain helpers cho Shopee Affiliate (port từ aShopee/shared/domains.js).
 * Hỗ trợ mọi host: affiliate.shopee.<tld>
 */

export type ShopeeAffiliateMarket = {
  host: string;
  code: string;
  label: string;
  mallHost: string;
  tld: string;
  imageCdn: string;
};

export function isAffiliateHost(hostname: string): boolean {
  return /^affiliate\.shopee\./i.test(String(hostname || ""));
}

function marketCodeFromTld(tld: string): string {
  const parts = String(tld || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (!parts.length) return "XX";
  return parts[parts.length - 1].toUpperCase();
}

export function getMarketByHost(hostname: string): ShopeeAffiliateMarket | null {
  const host = String(hostname || "").toLowerCase();
  const m = host.match(/^affiliate\.(shopee\..+)$/i);
  if (!m) return null;

  const mallHost = m[1].toLowerCase();
  const tld = mallHost.replace(/^shopee\./i, "");
  const code = marketCodeFromTld(tld);
  const cdnRegion = tld.split(".")[0] || code.toLowerCase();

  return {
    host,
    code,
    label: code,
    mallHost,
    tld,
    imageCdn: `https://down-${cdnRegion}.img.susercontent.com/file/`,
  };
}

export function isAffiliateProductOfferUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (!isAffiliateHost(u.hostname)) return false;
    return u.pathname.startsWith("/offer/product_offer");
  } catch {
    return false;
  }
}

export function defaultOfferUrl(host?: string): string {
  const h = isAffiliateHost(host || "") ? String(host).toLowerCase() : "affiliate.shopee.vn";
  return `https://${h}/offer/product_offer`;
}

/** URL list API: /api/v3/offer/product/list?...&list_type= */
export function isProductListApiUrl(rawUrl: string, pageOrigin?: string): boolean {
  if (!rawUrl || typeof rawUrl !== "string") return false;
  try {
    const url = new URL(rawUrl, pageOrigin || undefined);
    if (pageOrigin) {
      const origin = new URL(pageOrigin).origin;
      if (url.origin !== origin) return false;
    } else if (!isAffiliateHost(url.hostname)) {
      return false;
    }
    if (!url.pathname.includes("/api/v3/offer/product/list")) return false;
    return url.searchParams.has("list_type");
  } catch {
    return false;
  }
}

export function buildPageListUrl(templateUrl: string, pageOffset: number): string {
  const url = new URL(templateUrl);
  url.searchParams.set("page_offset", String(pageOffset));
  return url.toString();
}

export function getPageLimitFromListUrl(templateUrl: string, fallback = 20): number {
  try {
    const limit = parseInt(new URL(templateUrl).searchParams.get("page_limit") || "", 10);
    if (Number.isFinite(limit) && limit > 0) return limit;
  } catch {
    // ignore
  }
  return fallback;
}
