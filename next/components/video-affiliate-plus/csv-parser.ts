import { AffiliatePlusItem, createEmptyItem } from "./types";

/** Cột CSV Crawl Project / mẫu import Generate Video. */
export const SCRAPE_PROJECT_CSV_HEADERS = [
  "stt",
  "item_id",
  "shopid",
  "name",
  "shop_name",
  "description",
  "hashtags",
  "seller_commission_rate",
  "default_commission_rate",
  "long_link",
  "affiliate_link_short",
  "product_link",
  "image_url",
  "price",
] as const;

export type ScrapeProjectCsvHeader = (typeof SCRAPE_PROJECT_CSV_HEADERS)[number];

function escapeScrapeProjectCsvValue(value: unknown): string {
  if (value == null) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

/** Mẫu CSV import Generate Video — cùng cột với Crawl Project đã lưu. */
export function buildScrapeProjectImportTemplateCsv(): string {
  const sample: Record<ScrapeProjectCsvHeader, string> = {
    stt: "1",
    item_id: "12345678901",
    shopid: "123456",
    name: "Ten san pham mau",
    shop_name: "Ten shop mau",
    description: "Mo ta san pham mau. XEM NGAY.",
    hashtags: "#TagMau1,#TagMau2",
    seller_commission_rate: "5",
    default_commission_rate: "3",
    long_link: "https://affiliate.shopee.vn/offer/product_share?...",
    affiliate_link_short: "https://s.shopee.vn/xxxxx",
    product_link: "https://shopee.vn/product/123456/12345678901",
    image_url: "https://down-vn.img.susercontent.com/file/xxx",
    price: "199000",
  };
  const headerLine = SCRAPE_PROJECT_CSV_HEADERS.join(",");
  const sampleLine = SCRAPE_PROJECT_CSV_HEADERS.map((k) =>
    escapeScrapeProjectCsvValue(sample[k])
  ).join(",");
  return `\uFEFF${headerLine}\n${sampleLine}\n`;
}

/** Ghi CSV project chỉ gồm các cột chuẩn (theo thứ tự cố định). */
export function rowsToScrapeProjectCsv(rows: Record<string, unknown>[]): string {
  const headerLine = SCRAPE_PROJECT_CSV_HEADERS.map((k) => escapeScrapeProjectCsvValue(k)).join(
    ","
  );
  const dataLines = rows.map((row) =>
    SCRAPE_PROJECT_CSV_HEADERS.map((k) => escapeScrapeProjectCsvValue(row[k])).join(",")
  );
  return `\uFEFF${headerLine}\n${dataLines.join("\n")}`;
}

/**
 * Map theo TÊN CỘT (không theo vị trí).
 * Key = field nội bộ, value = các tên cột có thể gặp trong file Shopee / CSV.
 */
const HEADER_ALIASES: Record<string, string[]> = {
  shopName: [
    "tên shop",
    "ten shop",
    "ten_shop",
    "tên_shop",
    "shop_name",
    "shop name",
    "username",
    "tên account",
    "ten account",
    "ten_account",
    "account",
  ],
  shopId: ["mã shop", "ma shop", "ma_shop", "shop_id", "shopid", "shop id"],
  productId: [
    "mã sản phẩm",
    "ma san pham",
    "ma_san_pham",
    "mã_sản_phẩm",
    "product_id",
    "productid",
    "product id",
    "item_id",
    "itemid",
  ],
  productName: [
    "tên sản phẩm",
    "ten san pham",
    "ten_san_pham",
    "tên_sản_phẩm",
    "product_name",
    "product name",
    "sản phẩm",
    "san pham",
    "name",
  ],
  productLink: [
    "link sản phẩm",
    "link san pham",
    "link_san_pham",
    "link_sản_phẩm",
    "product_link",
    "product link",
    "product_url",
  ],
  affiliateLink: [
    "link affiliate",
    "link_affiliate",
    "affiliate link",
    "affiliate_link",
    "link affiliate shot",
    "link affiliate short",
    "affiliate_link_short",
    "affiliate link short",
    "affiliate link shot",
  ],
  longLink: ["long_link", "affiliate link long", "link affiliate long"],
  commission: [
    "hoa hồng shop",
    "hoa hong shop",
    "hoa hồng",
    "hoa hong",
    "hoa_hong",
    "commission",
    "seller_commission_rate",
    "max_commission_rate",
  ],
  defaultCommission: ["default_commission_rate", "hoa hồng mặc định", "hoa hong mac dinh"],
  description: ["description", "mo ta", "mô tả", "noi dung", "nội dung", "mo ta sp"],
  hashtags: ["hashtags", "hashtag", "tag", "tags"],
  price: ["price", "gia", "giá", "gia ban", "giá bán"],
  imageUrl: [
    "ảnh",
    "anh",
    "ảnh sản phẩm",
    "anh san pham",
    "anh_san_pham",
    "ảnh sp",
    "anh sp",
    "image",
    "image_url",
    "hình ảnh",
    "hinh anh",
    "product_image",
  ],
  prompt: [
    "prompt",
    "prompts",
    "nội dung prompt",
    "noi dung prompt",
    "generate_prompt",
    "caption",
    "nội dung caption",
    "noi dung caption",
  ],
  videoUrls: ["video", "video_url", "link_video", "videos", "file video", "file_video"],
  hostPort: ["host_port", "host port", "hostport", "proxy"],
  country: ["quốc gia", "quoc gia", "country", "country_code"],
  cookie: ["cookie", "cookies", "session"],
  delayMin: ["delay_min", "delay min"],
  delayMax: ["delay_max", "delay max", "delay"],
};

function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9_ ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cellToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((char === "," || char === ";") && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * Tìm field theo tên cột.
 * Ưu tiên khớp exact sau normalize; sau đó fuzzy theo từ khóa.
 * Tránh map nhầm "Đánh giá shop" → shopName, "Mã sản phẩm" → productName.
 */
function mapHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header);
  if (!normalized) return null;

  // Exact alias match (longest alias first to prefer "hoa hong shop" over "hoa hong")
  let bestField: string | null = null;
  let bestLen = -1;
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    for (const alias of aliases) {
      const a = normalizeHeader(alias);
      if (a === normalized && a.length > bestLen) {
        bestField = field;
        bestLen = a.length;
      }
    }
  }
  if (bestField) return bestField;

  // Fuzzy — chỉ khi exact không khớp (file encoding lỗi)
  if (/affiliate/i.test(header) || normalized.includes("link affiliate")) return "affiliateLink";
  if (normalized.startsWith("link") && normalized.includes("san pham")) return "productLink";
  if (normalized.startsWith("ten") && normalized.includes("san pham")) return "productName";
  if (normalized.startsWith("ten") && normalized.includes("shop")) return "shopName";
  if (normalized.startsWith("ma") && normalized.includes("san pham")) return "productId";
  if (normalized.startsWith("ma") && normalized.includes("shop") && !normalized.includes("san pham")) {
    return "shopId";
  }
  if (normalized === "anh" || normalized === "nh" || normalized.endsWith(" anh")) return "imageUrl";
  if (normalized.includes("hoa hong")) return "commission";

  return null;
}

function parseVideoUrls(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[|;\n]/)
    .map((v) => v.trim())
    .filter(Boolean);
}

function toRowArray(row: unknown): string[] {
  if (Array.isArray(row)) return row.map(cellToString);
  if (row && typeof row === "object") {
    return Object.keys(row)
      .filter((k) => /^\d+$/.test(k))
      .sort((a, b) => Number(a) - Number(b))
      .map((k) => cellToString((row as Record<string, unknown>)[k]));
  }
  return [];
}

function composeImportPrompt(raw: Record<string, string>): string {
  const desc = String(raw.description || "").trim();
  const tags = String(raw.hashtags || "").trim();
  if (desc && tags) return `${desc}\n${tags}`;
  return desc || tags || String(raw.prompt || "").trim();
}

function buildItemFromRaw(raw: Record<string, string>, index: number): AffiliatePlusItem {
  const videoUrls = parseVideoUrls(raw.videoUrls || "");
  const total = videoUrls.length;
  // Ưu tiên product_link; fallback affiliate short / long
  const productLink =
    raw.productLink || raw.affiliateLink || raw.longLink || "";
  const fromLink = extractShopeeShopItemIds(productLink);
  const productId =
    String(raw.productId || "").trim() || fromLink.itemId || "";
  const rawShopId = String(raw.shopId || "").trim();
  const shopId =
    (rawShopId && !/^row-\d+$/i.test(rawShopId) ? rawShopId : "") ||
    fromLink.shopId ||
    `row-${index + 1}`;

  return createEmptyItem({
    shopName: raw.shopName || "",
    shopId,
    productId,
    productName: raw.productName || "",
    productLink,
    commission: raw.commission || raw.defaultCommission || "",
    imageUrl: raw.imageUrl || "",
    prompt: composeImportPrompt(raw),
    videoUrls,
    hostPort: raw.hostPort || "",
    country: raw.country || "VN",
    cookie: raw.cookie || "",
    pending: total,
    uploaded: 0,
    delayMin: Number(raw.delayMin) || 180,
    delayMax: Number(raw.delayMax) || 245,
    status: "waiting",
  });
}

/** Parse shopId + itemId từ URL Shopee: /product/{shopId}/{itemId} hoặc -i.{shopId}.{itemId} */
export function extractShopeeShopItemIds(link: string): { shopId: string; itemId: string } {
  const raw = String(link || "").trim();
  if (!raw) return { shopId: "", itemId: "" };
  try {
    const path = raw.includes("://") ? new URL(raw).pathname : raw;
    const productMatch = path.match(/\/product\/(\d+)\/(\d+)/i);
    if (productMatch?.[1] && productMatch?.[2]) {
      return { shopId: productMatch[1], itemId: productMatch[2] };
    }
    const iMatch = path.match(/-i\.(\d+)\.(\d+)/i);
    if (iMatch?.[1] && iMatch?.[2]) {
      return { shopId: iMatch[1], itemId: iMatch[2] };
    }
  } catch {
    // ignore
  }
  return { shopId: "", itemId: "" };
}

/** Parse product id (itemId) từ URL Shopee. */
export function extractShopeeProductId(link: string): string {
  return extractShopeeShopItemIds(link).itemId;
}

/** Tên SP → PascalCase không dấu, viết liền (vd. "Áo Khoác Nam" → "AoKhoacNam"). */
export function toPascalCaseFileSlug(name: string, maxLen = 80): string {
  const cleaned = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim();
  if (!cleaned) return "";
  const pascal = cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("");
  return pascal.slice(0, Math.max(8, maxLen));
}

/**
 * Tên file video nối: itemId (mã sản phẩm từ link)
 * VD link https://shopee.vn/product/1632480189/42874449161
 * → 42874449161
 */
export function buildMergedVideoFileBase(item: {
  productName?: string;
  shopId?: string;
  productId?: string;
  productLink?: string;
  affiliateLink?: string;
  id?: string;
}): string {
  const fromLink = extractShopeeShopItemIds(
    String(item.productLink || item.affiliateLink || "").trim()
  );
  const itemId = String(item.productId || "").trim() || fromLink.itemId;
  if (itemId) return itemId;
  const fallback = String(item.id || "video")
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, "_")
    .slice(0, 40);
  return fallback || "video";
}

/** Build fieldMap từ hàng header — chỉ theo tên cột. */
function buildFieldMapFromHeaders(headers: string[]): (string | null)[] {
  return headers.map((h) => mapHeaderToField(h));
}

export function parseAffiliatePlusRows(rows: unknown[]): AffiliatePlusItem[] {
  const normalizedRows = rows.map(toRowArray).filter((row) => row.some(Boolean));

  if (normalizedRows.length === 0) return [];

  const firstRow = normalizedRows[0];
  const fieldMap = buildFieldMapFromHeaders(firstRow);
  const mappedCount = fieldMap.filter(Boolean).length;
  const hasMappedHeader = mappedCount >= 2; // ít nhất 2 cột nhận diện được
  const dataRows = hasMappedHeader ? normalizedRows.slice(1) : normalizedRows;

  return dataRows
    .map((values, index) => {
      const raw: Record<string, string> = {};

      if (hasMappedHeader) {
        fieldMap.forEach((field, colIndex) => {
          if (!field) return;
          const value = values[colIndex] || "";
          if (!value) return;

          if (field === "commission") {
            const headerName = normalizeHeader(firstRow[colIndex] || "");
            if (
              headerName.includes("shop") ||
              headerName === "seller_commission_rate" ||
              !raw.commission
            ) {
              raw.commission = value;
            }
            return;
          }

          if (field === "defaultCommission") {
            if (!raw.defaultCommission) raw.defaultCommission = value;
            return;
          }

          if (field === "affiliateLink") {
            const headerName = normalizeHeader(firstRow[colIndex] || "");
            if (
              headerName.includes("shot") ||
              headerName.includes("short") ||
              headerName === "affiliate_link_short" ||
              !raw.affiliateLink
            ) {
              raw.affiliateLink = value;
            }
            return;
          }

          if (field === "longLink") {
            if (!raw.longLink) raw.longLink = value;
            return;
          }

          if (field === "imageUrl") {
            const headerName = normalizeHeader(firstRow[colIndex] || "");
            // Ưu tiên image_url (CDN) hơn image (id)
            if (
              headerName === "image_url" ||
              headerName.includes("url") ||
              !raw.imageUrl
            ) {
              raw.imageUrl = value;
            }
            return;
          }

          if (!raw[field]) raw[field] = value;
        });
      } else if (values.length >= SCRAPE_PROJECT_CSV_HEADERS.length) {
        // Fallback: thứ tự mẫu Crawl Project / Generate Video
        raw.productId = values[1] || "";
        raw.shopId = values[2] || "";
        raw.productName = values[3] || "";
        raw.shopName = values[4] || "";
        raw.description = values[5] || "";
        raw.hashtags = values[6] || "";
        raw.commission = values[7] || "";
        raw.defaultCommission = values[8] || "";
        raw.longLink = values[9] || "";
        raw.affiliateLink = values[10] || "";
        raw.productLink = values[11] || "";
        raw.imageUrl = values[12] || "";
      } else {
        // Fallback khi không nhận ra header: giả định thứ tự đơn giản
        raw.shopName = values[0] || "";
        raw.productName = values[1] || "";
        raw.imageUrl = values[2] || "";
        raw.productLink = values[3] || "";
        raw.shopId = values[4] || "";
        raw.commission = values[5] || "";
      }

      return buildItemFromRaw(raw, index);
    })
    .filter((item) => item.shopName || item.productName || item.productLink || item.imageUrl);
}

export function parseAffiliatePlusCSV(text: string): AffiliatePlusItem[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  return parseAffiliatePlusRows(lines.map(parseCSVLine));
}

async function loadXlsx() {
  const mod: any = await import("xlsx");
  return mod?.default ?? mod;
}

/** Parse .xls / .xlsx / .csv — map cột theo tên header. */
export async function parseAffiliatePlusExcel(buffer: ArrayBuffer): Promise<AffiliatePlusItem[]> {
  const XLSX = await loadXlsx();
  if (!XLSX?.read || !XLSX?.utils?.sheet_to_json) {
    throw new Error("xlsx module failed to load");
  }

  const data = new Uint8Array(buffer);
  const workbook = XLSX.read(data, { type: "array", raw: false });
  const sheetName = workbook.SheetNames?.[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
  }) as unknown[];

  return parseAffiliatePlusRows(rows);
}

export function isExcelFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xls") ||
    name.endsWith(".xlsx") ||
    name.endsWith(".xlsm") ||
    name.endsWith(".csv") ||
    file.type.includes("spreadsheet") ||
    file.type.includes("excel") ||
    file.type === "text/csv"
  );
}

export function exportAffiliatePlusCSV(items: AffiliatePlusItem[]): string {
  const headers = [
    "ten_shop",
    "ten_san_pham",
    "anh_san_pham",
    "link_san_pham",
    "prompt",
    "id",
    "hoa_hong",
    "video",
    "video_noi",
    "host_port",
    "quoc_gia",
    "cookie",
    "delay_min",
    "delay_max",
  ];
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const rows = items.map((item) =>
    [
      item.shopName,
      item.productName,
      item.imageUrl,
      item.productLink,
      item.prompt,
      item.shopId,
      item.commission,
      item.videoUrls.join("|"),
      item.mergedVideoUrl || "",
      item.hostPort,
      item.country,
      item.cookie,
      item.delayMin,
      item.delayMax,
    ]
      .map((v) => escape(String(v)))
      .join(",")
  );

  return "\uFEFF" + [headers.join(","), ...rows].join("\n");
}
