/**
 * Domain helpers (port aShopee/shared/domains.js) — mọi host affiliate.shopee.*
 */

function isAffiliateHost(hostname) {
  return /^affiliate\.shopee\./i.test(String(hostname || ""));
}

function marketCodeFromTld(tld) {
  const parts = String(tld || "")
    .toLowerCase()
    .split(".")
    .filter(Boolean);
  if (!parts.length) return "XX";
  return parts[parts.length - 1].toUpperCase();
}

function getMarketByHost(hostname) {
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

function isAffiliateProductOfferUrl(url) {
  try {
    const u = new URL(url);
    if (!isAffiliateHost(u.hostname)) return false;
    return u.pathname.startsWith("/offer/product_offer");
  } catch {
    return false;
  }
}

function hostFromUrl(url) {
  try {
    return new URL(String(url || "")).hostname;
  } catch {
    return "";
  }
}
