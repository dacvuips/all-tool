/**
 * Country + Shopee URL builder (port từ MLS country.js / postshopee.md).
 */
export type ShopeeCountryCode = "vn" | "sg" | "ph" | "id" | "th" | "my" | "br";

export type ShopeeCountry = {
  code: ShopeeCountryCode;
  name: string;
  tld: string;
  timezone: string;
  language: string;
};

export const COUNTRIES: Record<ShopeeCountryCode, ShopeeCountry> = {
  vn: { code: "vn", name: "Việt Nam", tld: "vn", timezone: "Asia/Ho_Chi_Minh", language: "vi" },
  sg: { code: "sg", name: "Singapore", tld: "sg", timezone: "Asia/Singapore", language: "en" },
  ph: { code: "ph", name: "Philippines", tld: "ph", timezone: "Asia/Manila", language: "en" },
  id: { code: "id", name: "Indonesia", tld: "co.id", timezone: "Asia/Jakarta", language: "id" },
  th: { code: "th", name: "Thailand", tld: "co.th", timezone: "Asia/Bangkok", language: "th" },
  my: { code: "my", name: "Malaysia", tld: "com.my", timezone: "Asia/Kuala_Lumpur", language: "en" },
  br: { code: "br", name: "Brazil", tld: "com.br", timezone: "America/Sao_Paulo", language: "pt" },
};

export function getCountry(code?: string): ShopeeCountry {
  const key = String(code || "vn").trim().toLowerCase() as ShopeeCountryCode;
  return COUNTRIES[key] || COUNTRIES.vn;
}

export type ShopeeUrls = {
  SV_HOST: string;
  LIVE_HOST: string;
  SV_BASE: string;
  LIVE_BASE: string;
  SHOPEE_BASE: string;
  UPLOAD_IMAGE: string;
  PRECHECK: string;
  CREATE_POST: string;
  POST_PRODUCTS: string;
  USER_DETAIL: string;
  TIMELINE_ME: string;
  PARSE_URL: string;
  PREUPLOAD: string;
  REPORT_UPLOAD: string;
  REFERER: string;
  IMG_BASE: string;
  /** CDN upload endpoint (MLS dùng host VN cho mọi region) */
  VIDEO_UPLOAD: string;
  VIDEO_DOWNLOAD: (vid: string) => string;
  PRODUCT_URL: (shopId: string, itemId: string) => string;
};

export function buildUrls(countryCode?: string): ShopeeUrls {
  const c = getCountry(countryCode);
  const tld = c.tld;
  const sv = `https://sv.shopee.${tld}`;
  const live = `https://live.shopee.${tld}`;
  const mms = `https://api-quic.mms.shopee.${tld}`;

  return {
    SV_HOST: `sv.shopee.${tld}`,
    LIVE_HOST: `live.shopee.${tld}`,
    SV_BASE: sv,
    LIVE_BASE: live,
    SHOPEE_BASE: `https://shopee.${tld}`,
    UPLOAD_IMAGE: `${sv}/api/v2/biz/file/image`,
    PRECHECK: `${sv}/api/v2/biz/post/precheck`,
    CREATE_POST: `${sv}/api/v2/biz/post/create?os_type=2&system_version=34&sdk_version=1.61.2&model=samsung%20SM-G991B&android_performance=802`,
    POST_PRODUCTS: `${sv}/api/v2/post/products`,
    USER_DETAIL: `${sv}/api/v2/user/detail`,
    TIMELINE_ME: `${sv}/api/v2/timeline/me`,
    PARSE_URL: `${live}/api/v1/item/parse_url`,
    PREUPLOAD: `${mms}/uploadapi/api/v1/vod/preupload`,
    REPORT_UPLOAD: `${mms}/uploadapi/api/v1/vod/reportupload`,
    REFERER: `https://shopee.${tld}/`,
    IMG_BASE: `https://down-${c.code}.img.susercontent.com`,
    VIDEO_UPLOAD: "https://up-ws-vn.vod.susercontent.com/file/upload",
    VIDEO_DOWNLOAD: (vid: string) => `https://down-ws-global.vod.susercontent.com/${vid}.mp4`,
    PRODUCT_URL: (shopId, itemId) => `https://shopee.${tld}/product/${shopId}/${itemId}`,
  };
}

export function listCountries() {
  return Object.values(COUNTRIES).map((c) => ({ code: c.code, name: c.name, tld: c.tld }));
}
