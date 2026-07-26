export {
  defaultOfferUrl,
  getMarketByHost,
  isAffiliateHost,
  isAffiliateProductOfferUrl,
  isProductListApiUrl,
} from "./domains";
export type { ShopeeAffiliateMarket } from "./domains";

export {
  CSV_COLUMNS,
  PREFERRED_CSV_KEYS,
  collectCsvKeys,
  flattenProduct,
  productsToCsv,
  toImportRows,
} from "./product-mapper";
export type { ScrapeImportRow, ScrapedAffiliateProduct } from "./product-mapper";

export {
  buildCsvSession,
  getLastMarketHost,
  setLastMarketHost,
} from "./extension-push";
export type { ExtensionPushSession } from "./extension-push";

export {
  DEFAULT_CDP_PORT,
  ensureChromeCdp,
  findChromeExecutable,
  getCdpEndpoint,
  getCdpUserDataDir,
  openNormalChrome,
  probeCdpEndpoint,
} from "./open-chrome";

export {
  closeGpmLoginProfile,
  DEFAULT_GPMLOGIN_API,
  getGpmLoginRawProxy,
  getGpmLoginStatus,
  listGpmLoginProfiles,
  parseDebugAddr,
  probeGpmLoginApi,
  startGpmLoginProfile,
} from "./gpmlogin-client";
export type { GpmLoginProfile, GpmLoginStartResult } from "./gpmlogin-client";

export {
  clearAffiliateHttpSession,
  getAffiliateHttpSession,
  loadAffiliateHttpSession,
  requireAffiliateHttpSession,
  setAffiliateHttpSession,
} from "./session-store";
export type { AffiliateHttpSession } from "./session-store";

export {
  exportCsvViaCdp,
  fetchAffiliateShortLinks,
  fetchProductPageViaCdp,
  getCdpStatus,
  openAffiliateBrowserCdp,
} from "./cdp-browser";
export type {
  CdpExportInput,
  CdpProductPageInput,
  CdpProductPageResult,
} from "./cdp-browser";

/** Alias — GPM Login + lấy cookie → HTTP/CDP scrape. */
export { openAffiliateBrowserCdp as openAffiliateBrowser } from "./cdp-browser";
