/**
 * Client: sinh mô tả / hashtag SEO Shopee (tách riêng hoặc cả hai).
 * Cách call AI giống lọc Giỏ Video (customer Gateway / OpenAI / Gemini).
 */

import {
  AiApiError,
  AiAuthError,
  extractJsonText,
  providerLabel,
  resolveAiApiKey,
  type AiProvider,
} from "./gio-video-ai";

export type ProductSeoInput = {
  id: string;
  name: string;
};

/** Trường AI cần tạo — khớp Switch Lưu Project. */
export type ProductSeoFields = "description" | "hashtags" | "both";

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
export const MAX_DESCRIPTION_WORDS = 50;
const REQUEST_TIMEOUT_MS = 90000;
const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE_URL = "https://api.openai.com/v1";

function normalizeFields(fields?: ProductSeoFields): ProductSeoFields {
  if (fields === "description" || fields === "hashtags") return fields;
  return "both";
}

function fieldsLabel(fields: ProductSeoFields): string {
  if (fields === "description") return "mô tả";
  if (fields === "hashtags") return "hashtag";
  return "mô tả/hashtag";
}

const DESCRIPTION_RULES = `═══ description ═══
- Tiếng Việt, NGẮN: tối đa ${MAX_DESCRIPTION_WORDS} từ (~1 câu).
- Dựa trên TÊN sản phẩm: nêu lợi ích / điểm nổi bật rõ ràng.
- Kết thúc bằng CTA ngắn: "XEM NGAY".
- CẤM viết dài, CẤM bịa thông số/hãng không có trong tên.
- Không emoji thừa, không hashtag trong description.`;

const HASHTAG_RULES = `═══ hashtags ═══
- Đúng 4 đến 6 hashtag SEO Shopee.
- Dạng PascalCase, không dấu tiếng Việt, bắt đầu bằng #.
- Ví dụ đúng: #DoGiaDung #NhaBepTienIch #MeoVat #DealSoc #ShopeeAffiliate
- Phản ánh danh mục / công dụng / từ khóa tìm kiếm phổ biến trên Shopee từ tên SP.
- Không trùng lặp, không hashtag vô nghĩa.`;

/**
 * System prompt SEO — đồng bộ với backend `scrape-product-seo.route.ts`.
 */
export function buildProductSeoSystemPrompt(fields: ProductSeoFields = "both"): string {
  const f = normalizeFields(fields);
  const parts = [
    "BẠN LÀ CHUYÊN GIA SEO NỘI DUNG SHOPEE AFFILIATE (THỊ TRƯỜNG VIỆT NAM).",
    "CHỈ TRẢ VỀ JSON THUẦN, KHÔNG GIẢI THÍCH, KHÔNG MARKDOWN.",
    "",
    "NHIỆM VỤ: Với MỖI sản phẩm trong danh sách (có id + name), tạo nội dung đăng Affiliate:",
    "",
  ];
  if (f === "description" || f === "both") {
    parts.push(DESCRIPTION_RULES, "");
  }
  if (f === "hashtags" || f === "both") {
    parts.push(HASHTAG_RULES, "");
  }

  if (f === "description") {
    parts.push(
      "BẮT BUỘC — Output JSON đúng dạng:",
      "{",
      '  "products": [',
      "    {",
      '      "id": "shopId-itemId hoặc id đã cho",',
      '      "description": "..."',
      "    }",
      "  ]",
      "}",
      "Chỉ tạo description. Phải trả đủ MỌI id trong danh sách đầu vào."
    );
  } else if (f === "hashtags") {
    parts.push(
      "BẮT BUỘC — Output JSON đúng dạng:",
      "{",
      '  "products": [',
      "    {",
      '      "id": "shopId-itemId hoặc id đã cho",',
      '      "hashtags": ["#A", "#B", "#C", "#D"]',
      "    }",
      "  ]",
      "}",
      "Chỉ tạo hashtags. Phải trả đủ MỌI id trong danh sách đầu vào."
    );
  } else {
    parts.push(
      "BẮT BUỘC — Output JSON đúng dạng:",
      "{",
      '  "products": [',
      "    {",
      '      "id": "shopId-itemId hoặc id đã cho",',
      '      "description": "...",',
      '      "hashtags": ["#A", "#B", "#C", "#D"]',
      "    }",
      "  ]",
      "}",
      "Phải trả đủ MỌI id trong danh sách đầu vào."
    );
  }
  return parts.join("\n");
}

/** @deprecated dùng buildProductSeoSystemPrompt("both") */
export const PRODUCT_SEO_SYSTEM_PROMPT = buildProductSeoSystemPrompt("both");

export function buildProductSeoUserPrompt(
  products: ProductSeoInput[],
  fields: ProductSeoFields = "both"
): string {
  const f = normalizeFields(fields);
  const lines = products.map((p, i) => {
    const name = String(p.name || "").trim() || "(không tên)";
    return `${i + 1}. id=${p.id} | ${name}`;
  });
  let taskLine: string;
  if (f === "description") {
    taskLine = `Với MỖI SP: tạo description (≤${MAX_DESCRIPTION_WORDS} từ + CTA "XEM NGAY"). Không tạo hashtags.`;
  } else if (f === "hashtags") {
    taskLine = "Với MỖI SP: tạo 4–6 hashtags PascalCase. Không tạo description.";
  } else {
    taskLine = `Với MỖI SP: tạo description (≤${MAX_DESCRIPTION_WORDS} từ + CTA "XEM NGAY") và 4–6 hashtags PascalCase.`;
  }
  return [
    `Danh sách sản phẩm cần tạo ${fieldsLabel(f)} SEO Shopee:`,
    ...lines,
    "",
    taskLine,
    "Trả về JSON theo đúng schema đã nêu.",
  ].join("\n");
}

export function buildProductSeoMessages(
  products: ProductSeoInput[],
  fields: ProductSeoFields = "both"
) {
  return [
    { role: "system" as const, content: buildProductSeoSystemPrompt(fields) },
    { role: "user" as const, content: buildProductSeoUserPrompt(products, fields) },
  ];
}

/** Ghép system + user — dùng cho Gateway Flow2 (1 text). */
export function buildProductSeoFullPrompt(
  products: ProductSeoInput[],
  fields: ProductSeoFields = "both"
): string {
  return `${buildProductSeoSystemPrompt(fields)}\n\n${buildProductSeoUserPrompt(products, fields)}`;
}

function clipDescription(text: string): string {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= MAX_DESCRIPTION_WORDS) return words.join(" ");
  return words.slice(0, MAX_DESCRIPTION_WORDS).join(" ");
}

function normalizeHashtag(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "");
  return cleaned ? `#${cleaned}` : "";
}

function normalizeResult(
  id: string,
  raw?: {
    description?: string;
    hashtags?: string[];
  }
): ProductSeoResult {
  const description = clipDescription(String(raw?.description || "").trim());
  const list = (Array.isArray(raw?.hashtags) ? raw!.hashtags! : [])
    .map((t) => normalizeHashtag(String(t)))
    .filter(Boolean);
  const hashtagList = Array.from(new Set(list)).slice(0, 6);
  return {
    id,
    description,
    hashtagList,
    hashtags: hashtagList.join(","),
  };
}

function parseSeoProducts(
  jsonText: string,
  products: ProductSeoInput[]
): ProductSeoResult[] {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText || "{}");
  } catch {
    throw new AiApiError("AI trả về không phải JSON — giữ nguyên mô tả/hashtag");
  }
  const list = Array.isArray(parsed?.products) ? parsed.products : [];
  const byId = new Map<string, { description?: string; hashtags?: string[] }>();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const id = String((item as any).id || "").trim();
    if (!id) continue;
    byId.set(id, {
      description: (item as any).description,
      hashtags: Array.isArray((item as any).hashtags) ? (item as any).hashtags : [],
    });
  }
  return products.map((p) => normalizeResult(p.id, byId.get(p.id)));
}

/** Gateway Flow2 — cùng pattern scrape-gio-video-ai (customer endpoint + key). */
async function seoViaGateway(input: {
  products: ProductSeoInput[];
  endpoint: string;
  apiKey: string;
  model?: string;
  fields: ProductSeoFields;
}): Promise<{ text: string; model: string; products?: ProductSeoResult[] }> {
  const res = await fetch("/api/app/scrape-product-seo", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      products: input.products,
      endpoint: input.endpoint,
      apiKey: input.apiKey,
      fields: input.fields,
      ...(input.model ? { model: input.model } : {}),
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401 || res.status === 403) {
    throw new AiAuthError(
      (json as any)?.message || `Gateway API key sai/hết hạn/hết quyền (HTTP ${res.status}).`
    );
  }
  if (!res.ok) {
    throw new AiApiError((json as any)?.message || `Gateway AI lỗi HTTP ${res.status}`);
  }
  const data = (json as any)?.data || {};
  const list = Array.isArray(data.products) ? data.products : undefined;
  const products = list
    ? input.products.map((p) => {
        const hit = list.find((x: any) => String(x?.id) === p.id);
        return normalizeResult(p.id, hit);
      })
    : undefined;
  return {
    text: String(data.rawText || "").trim(),
    model: String(data.model || "gateway"),
    products,
  };
}

/** OpenAI / Gemini — cùng pattern lọc Giỏ Video (Agent proxy → gọi trực tiếp). */
async function chatCompletions(input: {
  apiKey: string;
  provider: "openai" | "gemini";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<{ text: string; model: string }> {
  const model = input.provider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL;

  try {
    const { agentFetch, probeScrapeAgent } = await import("./agent-client");
    const agent = await probeScrapeAgent(2000);
    if (agent.online) {
      const { res, json } = await agentFetch("/ai-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        timeoutMs: REQUEST_TIMEOUT_MS,
        body: JSON.stringify({
          apiKey: input.apiKey,
          provider: input.provider,
          model,
          messages: input.messages,
          temperature: 0.5,
          response_format: { type: "json_object" },
        }),
      });
      if (res.status === 401 || res.status === 403 || json?.status === 401 || json?.status === 403) {
        throw new AiAuthError(
          json?.message || `API key sai/hết hạn/hết credit (HTTP ${res.status}).`
        );
      }
      if (!res.ok || !json?.ok) {
        throw new AiApiError(json?.message || `AI lỗi HTTP ${res.status}`);
      }
      const text = String(json.content || "").trim();
      if (!text) throw new AiApiError("AI không trả nội dung");
      return { text, model: String(json.model || model) };
    }
  } catch (err: any) {
    if (err instanceof AiAuthError || err instanceof AiApiError) throw err;
  }

  const base = input.provider === "gemini" ? GEMINI_BASE_URL : OPENAI_BASE_URL;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(`${base}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: 0.5,
        response_format: { type: "json_object" },
      }),
    });
    const bodyText = await resp.text().catch(() => "");
    let json: any = null;
    try {
      json = bodyText ? JSON.parse(bodyText) : null;
    } catch {
      json = null;
    }
    if (resp.status === 401 || resp.status === 403) {
      throw new AiAuthError(
        json?.error?.message || `API key sai/hết hạn/hết credit (HTTP ${resp.status}).`
      );
    }
    if (!resp.ok) {
      throw new AiApiError(
        json?.error?.message || bodyText.slice(0, 200) || `API lỗi HTTP ${resp.status}`
      );
    }
    const text = String(json?.choices?.[0]?.message?.content || "").trim();
    if (!text) throw new AiApiError("AI không trả nội dung");
    return { text, model };
  } catch (err: any) {
    if (err instanceof AiAuthError || err instanceof AiApiError) throw err;
    if (err?.name === "AbortError") throw new AiApiError("AI timeout");
    throw new AiApiError(
      err?.message || "Lỗi gọi AI. Mở Shopee Scrape Agent (BatDau) để proxy tránh CORS."
    );
  } finally {
    clearTimeout(timer);
  }
}

async function generateSeoBatchOnce(
  products: ProductSeoInput[],
  cred: {
    apiKey: string;
    provider: AiProvider;
    endpoint?: string;
    model?: string;
  },
  fields: ProductSeoFields
): Promise<ProductSeoResult[]> {
  if (cred.provider === "gateway") {
    const endpoint = String(cred.endpoint || "").trim();
    if (!endpoint) throw new AiAuthError("Thiếu endpoint gateway.");
    const gw = await seoViaGateway({
      products,
      endpoint,
      apiKey: cred.apiKey,
      model: cred.model,
      fields,
    });
    if (gw.products) return gw.products;
    return parseSeoProducts(extractJsonText(gw.text), products);
  }

  const messages = buildProductSeoMessages(products, fields);
  const { text } = await chatCompletions({
    apiKey: cred.apiKey,
    provider: cred.provider,
    messages,
  });
  return parseSeoProducts(extractJsonText(text), products);
}

/**
 * Gộp id + tên → gọi AI customer theo batch (cùng cách Giỏ Video) → map theo id.
 * `fields`: chỉ tạo mô tả, chỉ hashtag, hoặc cả hai.
 */
export async function generateProductSeoBatch(
  products: ProductSeoInput[],
  onProgress?: (p: ProductSeoProgress) => void,
  keys?: {
    openaiKey?: string;
    geminiKey?: string;
    gatewayEndpoint?: string;
    gatewayApiKey?: string;
    gatewayModel?: string;
  },
  fields: ProductSeoFields = "both"
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

  const mode = normalizeFields(fields);
  const labelField = fieldsLabel(mode);

  const cred = resolveAiApiKey(keys?.openaiKey, keys?.geminiKey, {
    endpoint: keys?.gatewayEndpoint,
    apiKey: keys?.gatewayApiKey,
    model: keys?.gatewayModel,
  });

  if (!String(cred.apiKey || "").trim()) {
    throw new AiAuthError("Thiếu API key — không gọi AI.");
  }

  const out: ProductSeoResult[] = [];
  let done = 0;
  const label = providerLabel(cred.provider);

  for (let i = 0; i < list.length; i += BATCH_SIZE) {
    const chunk = list.slice(i, i + BATCH_SIZE);
    onProgress?.({
      done,
      total: list.length,
      level: "info",
      message: `AI (${label}) đang tạo ${labelField} ${done + 1}–${Math.min(
        done + chunk.length,
        list.length
      )}/${list.length}`,
    });
    try {
      const results = await generateSeoBatchOnce(chunk, cred, mode);
      out.push(...results);
      done += chunk.length;
      onProgress?.({
        done,
        total: list.length,
        level: "success",
        message: `AI (${label}) xong ${labelField} ${done}/${list.length} SP`,
      });
    } catch (err: any) {
      if (err instanceof AiAuthError) throw err;
      const msg = String(err?.message || err || "AI lỗi");
      for (const p of chunk) {
        out.push({ id: p.id, description: "", hashtags: "", hashtagList: [] });
      }
      done += chunk.length;
      onProgress?.({
        done,
        total: list.length,
        level: "warning",
        message: `AI lỗi batch — giữ nguyên ${labelField} (${done}/${list.length}): ${msg.slice(
          0,
          120
        )}`,
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
