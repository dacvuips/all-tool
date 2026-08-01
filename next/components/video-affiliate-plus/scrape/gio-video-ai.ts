/**
 * PeeCrawl AI Worker (không mall search): lọc SP cùng sản phẩm theo TÊN.
 * - OpenAI / Gemini: key khách hàng (trình duyệt / Local Agent)
 * - gateway: customer tự nhập endpoint + API key (Flow2 ChatGPT, cùng cách call ai-scene-more)
 */

import {
  applyFinalVideoFilter,
  type GioSortRow,
  type SimilarOfferItem,
} from "./gio-video-fetch";

export type AiProvider = "openai" | "gemini" | "gateway";

export type AiMatchedItem = {
  id: string;
  confidence: number;
};

export type AiFilterResult = {
  matchedItems: AiMatchedItem[];
  summary: string;
  provider: AiProvider;
  model: string;
  rawText: string;
};

export class AiAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiAuthError";
  }
}

export class AiApiError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiApiError";
  }
}

const OPENAI_MODEL = "gpt-4o-mini";
const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
const OPENAI_BASE_URL = "https://api.openai.com/v1";
const REQUEST_TIMEOUT_MS = 90000;
const MIN_CONFIDENCE = 0.9;

/** System prompt PeeCrawl ai_worker (TEXT-ONLY, đối chiếu theo tên). */
export const PEECRAWL_SYSTEM_PROMPT = `BẠN LÀ MÁY ĐỐI CHIẾU SẢN PHẨM CỰC KỲ KHẮT KHE. CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH.

NHIỆM VỤ: Xác định trong danh sách những SP là CÙNG MỘT SẢN PHẨM với SP gốc
(đối chiếu theo TÊN). Đây là lọc để gán link video thay thế — chọn SAI (khác
hãng / khác mã) là lỗi NẶNG hơn bỏ sót. Vì vậy mặc định là LOẠI, chỉ chọn khi
CHẮC CHẮN cùng hãng + cùng dòng sản phẩm.

═══ BƯỚC 1: TRÍCH ĐỊNH DANH SP GỐC ═══
Từ TÊN sản phẩm gốc, rút ra:
- THƯƠNG HIỆU / nhà bán ghi trên tên (vd: "Tân Dân Lợi", "Anker", "Thiên Phong").
- LOẠI SP cụ thể + công dụng (vd: bánh trung thu 2 trứng 200g; sạc dự phòng).
- SỐ HIỆU / MÃ định danh (vd A1263, CV101) NẾU có.
- THÔNG SỐ định danh: trọng lượng/khối lượng, dung lượng, kích cỡ, số lượng/
  biến thể (vd 200g, "2 trứng", 10000mAh, 75g).

═══ BƯỚC 2: ĐỐI CHIẾU TỪNG TÊN ═══
CHỈ chọn (MATCH) khi THỎA HẾT 3 điều kiện:
1. CÙNG THƯƠNG HIỆU với SP gốc. Tên không ghi hãng, hoặc hãng khác → LOẠI ngay.
   (vd gốc "Tân Dân Lợi" thì "Hoa Nắng", "Như Trang Plaza" = LOẠI.)
2. CÙNG LOẠI SP + cùng công dụng cụ thể (KHÔNG chấp nhận "cùng nhóm" chung chung).
   (vd hộp đựng BÁNH TRUNG THU vs hộp đựng CUPCAKE = khác SP = LOẠI.)
3. SỐ HIỆU/MÃ khớp NẾU SP gốc có: gốc có mã (A1263) thì tên phải chứa ĐÚNG mã đó;
   khác/thiếu mã (A1281) = LOẠI. Nếu SP gốc KHÔNG có mã: các THÔNG SỐ định danh
   chính (trọng lượng, dung lượng, số trứng, kích cỡ...) phải khớp; lệch bất kỳ
   thông số chính nào = LOẠI.

BẤT KỲ nghi ngờ nào (thiếu hãng, thiếu thông số để so, mô tả mơ hồ) → LOẠI.
KHÔNG suy đoán có lợi. Thà bỏ sót còn hơn chọn nhầm SP khác.

KẾT QUẢ: CHỈ liệt kê SP đạt CẢ 3 điều kiện (confidence ≥ 0.9) vào matched_items.
Còn lại BỎ QUA, KHÔNG liệt kê.

BẮT BUỘC: Output PHẢI là JSON thuần (response_format json_object), NGẮN GỌN, KHÔNG kèm lý do:
{
  "matched_items": [
    {"id": "itemid", "confidence": 0.95}
  ],
  "summary": "X/Y sản phẩm trùng hãng+dòng"
}
Nếu không có SP nào đạt: matched_items = [].`;

/** Giống PeeCrawl detect_provider. */
export function detectProvider(apiKey: string): "openai" | "gemini" {
  const key = String(apiKey || "").trim();
  if (/^(AIza|AQ\.)/i.test(key)) return "gemini";
  return "openai";
}

/**
 * Resolve credential gọi AI.
 * Ưu tiên: Gateway (endpoint + API key) → OpenAI key → Gemini key.
 * Tất cả do customer nhập — không dùng key hệ thống.
 */
export function resolveAiApiKey(
  openaiKey?: string,
  geminiKey?: string,
  gateway?: { endpoint?: string; apiKey?: string; model?: string }
): {
  apiKey: string;
  provider: AiProvider;
  endpoint?: string;
  model?: string;
} {
  const endpoint = String(gateway?.endpoint || "").trim();
  const gatewayKey = String(gateway?.apiKey || "").trim();
  const gatewayModel = String(gateway?.model || "").trim();
  if (endpoint && gatewayKey && gatewayModel) {
    return {
      apiKey: gatewayKey,
      provider: "gateway",
      endpoint,
      model: gatewayModel,
    };
  }
  if (endpoint || gatewayKey || gatewayModel) {
    const missing: string[] = [];
    if (!endpoint) missing.push("Endpoint");
    if (!gatewayKey) missing.push("API Key");
    if (!gatewayModel) missing.push("Model");
    throw new AiAuthError(
      `Gateway chưa đủ: thiếu ${missing.join(", ")} (cần đủ Endpoint + API Key + Model).`
    );
  }

  const openai = String(openaiKey || "").trim();
  const gemini = String(geminiKey || "").trim();
  if (openai) {
    return { apiKey: openai, provider: detectProvider(openai) };
  }
  if (gemini) {
    return { apiKey: gemini, provider: detectProvider(gemini) };
  }
  throw new AiAuthError(
    "Thiếu API. Nhập Endpoint + API Key (gateway), hoặc OpenAI Key / Gemini Key."
  );
}

export function providerLabel(provider: AiProvider): string {
  if (provider === "gemini") return "Gemini";
  if (provider === "gateway") return "Gateway";
  return "OpenAI";
}

export function buildUserPrompt(
  originalName: string,
  similarItems: Array<{ id: string; name: string }>
): string {
  const lines = similarItems.map((s, i) => {
    const name = String(s.name || "").trim() || "(không tên)";
    return `${i + 1}. id=${s.id} | ${name}`;
  });
  return [
    `Sản phẩm gốc — Tên: "${String(originalName || "").trim() || "(không tên)"}"`,
    "",
    "Danh sách SP tương tự cần phân loại:",
    ...lines,
    "",
    "Hãy xác định SP nào CÙNG LOẠI với SP gốc (đối chiếu theo TÊN). Trả về JSON.",
  ].join("\n");
}

export function buildMessages(originalName: string, similarItems: Array<{ id: string; name: string }>) {
  return [
    { role: "system" as const, content: PEECRAWL_SYSTEM_PROMPT },
    { role: "user" as const, content: buildUserPrompt(originalName, similarItems) },
  ];
}

/** Lấy JSON object từ text (phòng markdown code fence). */
export function extractJsonText(raw: string): string {
  const text = String(raw || "").trim();
  if (!text) return "";
  const fence = text.match(/```(?:json|text|markdown)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) return fence[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) return text.slice(start, end + 1);
  return text;
}

function parseMatchedItems(jsonText: string): { matchedItems: AiMatchedItem[]; summary: string } {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    throw new AiApiError("AI trả về không phải JSON → dùng link gốc");
  }
  const list = Array.isArray(parsed?.matched_items)
    ? parsed.matched_items
    : Array.isArray(parsed?.matchedItems)
      ? parsed.matchedItems
      : [];
  const matchedItems: AiMatchedItem[] = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const id = String((row as any).id ?? (row as any).item_id ?? (row as any).itemId ?? "").trim();
    const confidence = Number((row as any).confidence);
    if (!id) continue;
    if (!Number.isFinite(confidence) || confidence < MIN_CONFIDENCE) continue;
    matchedItems.push({ id, confidence });
  }
  return {
    matchedItems,
    summary: String(parsed?.summary || "").trim(),
  };
}

/** Gọi backend Flow2 ChatGPT với endpoint + API key (+ model) do customer nhập. */
async function filterViaGateway(input: {
  originalName: string;
  similarItems: Array<{ id: string; name: string }>;
  endpoint: string;
  apiKey: string;
  model?: string;
}): Promise<{ text: string; model: string; matchedItems?: AiMatchedItem[]; summary?: string }> {
  const res = await fetch("/api/app/scrape-gio-video-ai", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      originalName: input.originalName,
      similarItems: input.similarItems,
      endpoint: input.endpoint,
      apiKey: input.apiKey,
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
  const matchedItems = Array.isArray(data.matchedItems) ? data.matchedItems : undefined;
  return {
    text: String(data.rawText || "").trim(),
    model: String(data.model || "gateway"),
    matchedItems,
    summary: String(data.summary || "").trim() || undefined,
  };
}

async function chatCompletions(input: {
  apiKey: string;
  provider: "openai" | "gemini";
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}): Promise<{ text: string; model: string }> {
  const model = input.provider === "gemini" ? GEMINI_MODEL : OPENAI_MODEL;

  // Ưu tiên Local Agent proxy (tránh CORS trình duyệt)
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
          temperature: 0,
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
    // Agent offline / lỗi mạng → thử gọi trực tiếp (có thể CORS)
  }

  const base = input.provider === "gemini" ? GEMINI_BASE_URL : OPENAI_BASE_URL;
  const url = `${base}/chat/completions`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const resp = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: input.messages,
        temperature: 0,
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
        json?.error?.message ||
          `API key sai/hết hạn/hết credit (HTTP ${resp.status}).`
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
      err?.message ||
        "Lỗi gọi AI. Mở Shopee Scrape Agent (BatDau) để proxy tránh CORS."
    );
  } finally {
    clearTimeout(timer);
  }
}

/** Gọi OpenAI / Gemini / Gateway (endpoint+key) lọc similar theo tên. */
export async function filterSimilarProductsWithAi(input: {
  originalName: string;
  similarItems: Array<{ id: string; name: string }>;
  openaiKey?: string;
  geminiKey?: string;
  gatewayEndpoint?: string;
  gatewayApiKey?: string;
  gatewayModel?: string;
  /** Key customer đã resolve từ UI */
  apiKey?: string;
  provider?: AiProvider;
  endpoint?: string;
  model?: string;
}): Promise<AiFilterResult> {
  const resolved =
    input.provider === "gateway" && input.endpoint && input.apiKey
      ? {
          apiKey: input.apiKey,
          provider: "gateway" as const,
          endpoint: input.endpoint,
          model: String(input.model || "").trim() || undefined,
        }
      : input.apiKey && input.provider && input.provider !== "gateway"
        ? { apiKey: input.apiKey, provider: input.provider }
        : resolveAiApiKey(input.openaiKey, input.geminiKey, {
            endpoint: input.gatewayEndpoint,
            apiKey: input.gatewayApiKey,
            model: input.gatewayModel,
          });

  if (!String(resolved.apiKey || "").trim()) {
    throw new AiAuthError("Thiếu API key — không gọi AI.");
  }

  const items = (input.similarItems || []).filter((s) => s?.id);
  if (!items.length) {
    return {
      matchedItems: [],
      summary: "0/0 — không có SP tương tự",
      provider: resolved.provider,
      model:
        resolved.provider === "gemini"
          ? GEMINI_MODEL
          : resolved.provider === "gateway"
            ? String(resolved.model || "gateway")
            : OPENAI_MODEL,
      rawText: "",
    };
  }

  if (resolved.provider === "gateway") {
    const endpoint = String(resolved.endpoint || "").trim();
    if (!endpoint) throw new AiAuthError("Thiếu endpoint gateway.");
    const gw = await filterViaGateway({
      originalName: input.originalName,
      similarItems: items,
      endpoint,
      apiKey: resolved.apiKey,
      model: resolved.model,
    });
    if (gw.matchedItems) {
      return {
        matchedItems: gw.matchedItems.filter(
          (m) => m?.id && Number.isFinite(m.confidence) && m.confidence >= MIN_CONFIDENCE
        ),
        summary: gw.summary || "",
        provider: "gateway",
        model: gw.model,
        rawText: gw.text,
      };
    }
    const { matchedItems, summary } = parseMatchedItems(extractJsonText(gw.text));
    return {
      matchedItems,
      summary,
      provider: "gateway",
      model: gw.model,
      rawText: gw.text,
    };
  }

  const messages = buildMessages(input.originalName, items);
  const { text, model } = await chatCompletions({
    apiKey: resolved.apiKey,
    provider: resolved.provider,
    messages,
  });
  const { matchedItems, summary } = parseMatchedItems(extractJsonText(text));
  return {
    matchedItems,
    summary,
    provider: resolved.provider,
    model,
    rawText: text,
  };
}

/**
 * Map AI matched id (itemid hoặc shopId-itemId) → SimilarOfferItem từ DETAIL.
 */
export function mapAiMatchesToSimilars(
  detailSimilars: SimilarOfferItem[],
  matchedItems: AiMatchedItem[],
  excludeKey: string,
  excludeItemId: string
): SimilarOfferItem[] {
  const byItemId = new Map<string, SimilarOfferItem>();
  const byKey = new Map<string, SimilarOfferItem>();
  for (const s of detailSimilars) {
    if (!s?.key) continue;
    if (s.key === excludeKey || s.itemId === excludeItemId) continue;
    byKey.set(s.key, s);
    if (s.itemId) byItemId.set(s.itemId, s);
  }

  const out: SimilarOfferItem[] = [];
  const seen = new Set<string>();
  for (const m of matchedItems) {
    const raw = String(m.id || "").trim();
    if (!raw || raw === excludeKey || raw === excludeItemId) continue;
    const hit =
      byKey.get(raw) ||
      byItemId.get(raw) ||
      (() => {
        const parts = raw.split("-");
        const itemOnly = parts.length >= 2 ? parts[parts.length - 1] : "";
        return itemOnly ? byItemId.get(itemOnly) : undefined;
      })();
    if (!hit || seen.has(hit.key)) continue;
    seen.add(hit.key);
    out.push(hit);
  }
  return out;
}

/**
 * PeeCrawl không mall:
 * ① AI lọc theo tên → matches
 * ② Lọc lần 2: sort UI + prepend SP gốc
 * AI lỗi → chỉ SP gốc (giỏ≈1)
 */
export function selectVideoCartWithAiMatches(
  detailSimilars: SimilarOfferItem[],
  matchedItems: AiMatchedItem[],
  sourceKey: string,
  excludeItemId: string,
  sortRows: GioSortRow[]
): {
  cart: SimilarOfferItem[];
  selectedIds: string[];
  source: "ai" | "source_only";
  matchCount: number;
} {
  const excludeKey = String(sourceKey || "").trim();
  const matches = mapAiMatchesToSimilars(
    detailSimilars,
    matchedItems,
    excludeKey,
    excludeItemId
  );
  const { cart, selectedIds } = applyFinalVideoFilter(matches, sortRows, excludeKey);
  return {
    cart,
    selectedIds,
    source: matches.length > 0 ? "ai" : "source_only",
    matchCount: matches.length,
  };
}

