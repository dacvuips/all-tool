import { AffiliatePlusItem, createEmptyItem } from "./types";

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
  ],
  shopId: ["mã shop", "ma shop", "ma_shop", "shop_id", "shopid", "shop id"],
  productName: [
    "tên sản phẩm",
    "ten san pham",
    "ten_san_pham",
    "tên_sản_phẩm",
    "product_name",
    "product name",
    "sản phẩm",
    "san pham",
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
  affiliateLink: ["link affiliate", "link_affiliate", "affiliate link", "affiliate_link"],
  commission: [
    "hoa hồng shop",
    "hoa hong shop",
    "hoa hồng mặc định",
    "hoa hong mac dinh",
    "hoa hồng tối đa",
    "hoa hong toi da",
    "hoa hồng",
    "hoa hong",
    "hoa_hong",
    "commission",
  ],
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
  prompt: ["prompt", "prompts", "nội dung prompt", "noi dung prompt", "generate_prompt"],
  videoUrls: ["video", "video_url", "link_video", "videos", "caption"],
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

function buildItemFromRaw(raw: Record<string, string>, index: number): AffiliatePlusItem {
  const videoUrls = parseVideoUrls(raw.videoUrls || "");
  const total = videoUrls.length;

  return createEmptyItem({
    shopName: raw.shopName || "",
    shopId: raw.shopId || `row-${index + 1}`,
    productName: raw.productName || "",
    // Ưu tiên link affiliate nếu có
    productLink: raw.affiliateLink || raw.productLink || "",
    commission: raw.commission || "",
    imageUrl: raw.imageUrl || "",
    prompt: raw.prompt || "",
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
            // Ưu tiên "Hoa hồng shop" hơn mặc định / tối đa
            if (headerName.includes("shop") || !raw.commission) {
              raw.commission = value;
            }
            return;
          }

          if (!raw[field]) raw[field] = value;
        });
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
