/**
 * Client: sinh mô tả + hashtag SEO Shopee qua ChatGPT (backend Flow2).
 */

export type ProductSeoInput = {
  id: string;
  name: string;
};

export type ProductSeoResult = {
  id: string;
  description: string;
  /** Chuỗi hashtag cách nhau bởi dấu phẩy, vd `#DoGiaDung,#NhaBep` */
  hashtags: string;
  hashtagList: string[];
};

export type ProductSeoProgress = {
  done: number;
  total: number;
  message: string;
  level?: "info" | "success" | "warning" | "error";
};

const BATCH_SIZE = 50;
/** Mô tả tối đa ~50 chữ (từ). */
const MAX_DESCRIPTION_WORDS = 50;

function clipDescription(text: string): string {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= MAX_DESCRIPTION_WORDS) return words.join(" ");
  return words.slice(0, MAX_DESCRIPTION_WORDS).join(" ");
}

function fallbackDescription(name: string): string {
  const title = (name.trim() || "sản phẩm").split(/\s+/).slice(0, 8).join(" ");
  return clipDescription(`Mua ${title} giá tốt trên Shopee. Uy tín, giao nhanh. XEM NGAY!`);
}

function fallbackHashtags(name: string): string[] {
  const words = String(name || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length >= 3)
    .slice(0, 4)
    .map((w) => `#${w.charAt(0).toUpperCase()}${w.slice(1).toLowerCase()}`);
  const base = ["#Shopee", "#Affiliate", "#DealTot", "#MuaSamOnline"];
  return Array.from(new Set([...words, ...base])).slice(0, 6);
}

function normalizeResult(id: string, name: string, raw?: {
  description?: string;
  hashtags?: string[];
}): ProductSeoResult {
  const description =
    clipDescription(String(raw?.description || "").trim()) || fallbackDescription(name);
  const list = (Array.isArray(raw?.hashtags) ? raw!.hashtags! : [])
    .map((t) => {
      const cleaned = String(t || "")
        .trim()
        .replace(/^#+/, "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/gi, "d")
        .replace(/[^a-zA-Z0-9]/g, "");
      return cleaned ? `#${cleaned}` : "";
    })
    .filter(Boolean);
  const unique = Array.from(new Set(list));
  const hashtagList = unique.length >= 4 ? unique.slice(0, 6) : fallbackHashtags(name);
  return {
    id,
    description,
    hashtagList,
    hashtags: hashtagList.join(","),
  };
}

async function fetchSeoBatch(products: ProductSeoInput[]): Promise<ProductSeoResult[]> {
  const res = await fetch("/api/app/scrape-product-seo", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ products }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any)?.message || `Lỗi AI SEO (${res.status})`);
  }
  const json = await res.json();
  const list = Array.isArray(json?.data?.products) ? json.data.products : [];
  const byId = new Map<string, { description?: string; hashtags?: string[] }>();
  for (const item of list) {
    if (!item?.id) continue;
    byId.set(String(item.id), {
      description: item.description,
      hashtags: item.hashtags,
    });
  }
  return products.map((p) => normalizeResult(p.id, p.name, byId.get(p.id)));
}

/**
 * Gộp id + tên → gọi AI theo batch → map kết quả theo id.
 */
export async function generateProductSeoBatch(
  products: ProductSeoInput[],
  onProgress?: (p: ProductSeoProgress) => void
): Promise<ProductSeoResult[]> {
  const unique = new Map<string, ProductSeoInput>();
  for (const p of products) {
    const id = String(p.id || "").trim();
    const name = String(p.name || "").trim();
    if (!id || !name) continue;
    if (!unique.has(id)) unique.set(id, { id, name });
  }
  const list = Array.from(unique.values());
  if (!list.length) return [];

  const out: ProductSeoResult[] = [];
  let done = 0;

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const chunk = list.slice(i, i + BATCH_SIZE);
    onProgress?.({
      done,
      total: list.length,
      level: "info",
      message: `AI đang tạo mô tả/hashtag ${done + 1}–${Math.min(done + chunk.length, list.length)}/${list.length}`,
    });
    try {
      const results = await fetchSeoBatch(chunk);
      out.push(...results);
      done += chunk.length;
      onProgress?.({
        done,
        total: list.length,
        level: "success",
        message: `AI xong ${done}/${list.length} SP`,
      });
    } catch (err: any) {
      const msg = String(err?.message || err || "AI lỗi");
      for (const p of chunk) {
        out.push(normalizeResult(p.id, p.name));
      }
      done += chunk.length;
      onProgress?.({
        done,
        total: list.length,
        level: "warning",
        message: `AI lỗi batch — dùng mô tả mẫu (${done}/${list.length}): ${msg.slice(0, 120)}`,
      });
    }
  }

  return out;
}

/** Object làm việc trước khi gọi AI — các field trống sẽ được điền. */
export function buildProductSeoWorkItems(
  rows: Array<{ id: string; productName: string; raw?: Record<string, unknown> }>
): Array<{
  id: string;
  productId: string;
  productName: string;
  description: string;
  hashtags: string;
}> {
  return rows.map((r) => {
    const raw = (r.raw || {}) as Record<string, unknown>;
    const productId = String(
      raw.item_id ?? raw.itemid ?? raw.product_id ?? r.id ?? ""
    ).trim();
    return {
      id: String(r.id || productId),
      productId: productId || String(r.id || ""),
      productName: String(r.productName || raw.name || "").trim(),
      description: "",
      hashtags: "",
    };
  });
}
