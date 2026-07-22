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
  ackExtensionSessions,
  getLastMarketHost,
  listAllExtensionSessions,
  listPendingExtensionSessions,
  openAffiliateBrowser,
  pushExtensionCsv,
} from "./extension-push";
export type { ExtensionPushSession } from "./extension-push";

export { buildExtensionZipBuffer, getExtensionSourceDir } from "./extension-package";
