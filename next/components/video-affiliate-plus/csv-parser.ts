import { AffiliatePlusItem, createEmptyItem } from "./types";

const HEADER_ALIASES: Record<string, string[]> = {
  shopName: ["ten_shop", "tên shop", "tên_shop", "shop", "shop_name", "ten shop", "name", "username"],
  shopId: ["id", "shop_id", "shopid", "ma_shop", "mã shop"],
  commission: ["hoa_hong", "hoa hồng", "hoa hong", "commission", "hoa_hồng"],
  imageUrl: ["anh", "ảnh", "image", "image_url", "hinh_anh", "hình ảnh"],
  videoUrls: ["video", "video_url", "link_video", "videos", "caption"],
  hostPort: ["host_port", "host port", "hostport", "proxy"],
  country: ["quoc_gia", "quốc gia", "country", "country_code"],
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
    .replace(/[^a-z0-9_ ]/g, "");
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

function mapHeaderToField(header: string): string | null {
  const normalized = normalizeHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some((alias) => normalizeHeader(alias) === normalized)) {
      return field;
    }
  }
  return null;
}

function parseVideoUrls(value: string): string[] {
  if (!value) return [];
  return value.split(/[|;\n]/).map((v) => v.trim()).filter(Boolean);
}

export function parseAffiliatePlusCSV(text: string): AffiliatePlusItem[] {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  const headers = parseCSVLine(lines[0]);
  const fieldMap = headers.map((h) => mapHeaderToField(h));
  const hasMappedHeader = fieldMap.some(Boolean);
  const dataLines = hasMappedHeader ? lines.slice(1) : lines;

  return dataLines.map((line, index) => {
    const values = parseCSVLine(line);
    const raw: Record<string, string> = {};

    if (hasMappedHeader) {
      fieldMap.forEach((field, colIndex) => {
        if (field) raw[field] = values[colIndex] || "";
      });
    } else {
      raw.shopName = values[0] || "";
      raw.shopId = values[1] || "";
      raw.commission = values[2] || "";
      raw.imageUrl = values[3] || "";
      raw.videoUrls = values[4] || "";
      raw.hostPort = values[5] || "";
      raw.country = values[6] || "VN";
      raw.cookie = values[7] || "";
    }

    const videoUrls = parseVideoUrls(raw.videoUrls || "");
    const total = videoUrls.length;

    return createEmptyItem({
      shopName: raw.shopName || "",
      shopId: raw.shopId || `row-${index + 1}`,
      commission: raw.commission || "",
      imageUrl: raw.imageUrl || "",
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
  });
}

export function exportAffiliatePlusCSV(items: AffiliatePlusItem[]): string {
  const headers = [
    "ten_shop",
    "id",
    "hoa_hong",
    "anh",
    "video",
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
      item.shopId,
      item.commission,
      item.imageUrl,
      item.videoUrls.join("|"),
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
