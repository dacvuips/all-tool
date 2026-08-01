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
  createGpmLoginGroup,
  createGpmLoginProfile,
  DEFAULT_GPMLOGIN_API,
  deleteGpmLoginProfile,
  duplicateGpmLoginProfile,
  getGpmLoginProfile,
  getGpmLoginRawProxy,
  getGpmLoginStatus,
  listGpmLoginGroups,
  listGpmLoginProfiles,
  openGpmLoginProfileFolder,
  parseDebugAddr,
  probeGpmLoginApi,
  probeGpmLoginCdpPort,
  probeGpmLoginRunningStatuses,
  startGpmLoginProfile,
  toGpmLoginRawProxy,
  updateGpmLoginProfile,
} from "./gpmlogin-client";
export type {
  CreateGpmLoginProfileInput,
  GpmLoginGroup,
  GpmLoginProfile,
  GpmLoginStartResult,
  UpdateGpmLoginProfileInput,
} from "./gpmlogin-client";

export {
  createShopeeAccountGpmProfile,
  ensureSpcFInCookies,
  parseCookieHeaderPairs,
  refreshShopeeGpmProfileCookies,
  resolveShopeeMallHost,
  resolveShopeeLoginUrl,
} from "./create-account-profile";
export type {
  CreateShopeeAccountGpmProfileInput,
  CreateShopeeAccountGpmProfileResult,
  RefreshShopeeGpmProfileCookiesInput,
  RefreshShopeeGpmProfileCookiesResult,
  SavedGpmProfileSession,
} from "./create-account-profile";

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
  extractSimilarFromDetailPayload,
  fetchAffiliateShortLinks,
  fetchProductDetailViaCdp,
  fetchProductPageViaCdp,
  getCdpStatus,
  openAffiliateBrowserCdp,
  searchSimilarByImageViaCdp,
} from "./cdp-browser";
export type {
  CdpExportInput,
  CdpImageSearchInput,
  CdpImageSearchResult,
  CdpProductDetailInput,
  CdpProductDetailResult,
  CdpProductPageInput,
  CdpProductPageResult,
} from "./cdp-browser";

/** Alias — GPM Login + lấy cookie → HTTP/CDP scrape. */
export { openAffiliateBrowserCdp as openAffiliateBrowser } from "./cdp-browser";
