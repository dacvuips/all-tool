/**
 * Client: gợi ý từ khóa Shopee (≥200) qua Gateway / OpenAI / Gemini.
 */

import { AiApiError, AiAuthError, resolveAiApiKey, type AiProvider } from "./gio-video-ai";

const MIN_KEYWORDS = 200;
const REQUEST_TIMEOUT_MS = 120000;

function normalizeKeyword(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;]+|[,;]+$/g, "");
}

export function uniqueKeywords(list: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    const k = normalizeKeyword(item);
    if (!k) continue;
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
  }
  return out;
}

function buildMessages(seedKeywords: string[], need: number) {
  const seeds = uniqueKeywords(seedKeywords);
  const system = `Bạn là chuyên gia SEO Shopee VN. Chỉ trả JSON {"keywords":[...]} — không markdown.`;
  const user = [
    `Tạo ÍT NHẤT ${need} từ khóa tìm kiếm sản phẩm chuẩn trên Shopee (tiếng Việt).`,
    `Mỗi từ khóa 1–5 từ, đa dạng danh mục (thời trang, mẹ bé, đồ chơi, điện tử, nhà cửa, làm đẹp...).`,
    `Ví dụ: đồ nam, mẹ và bé, đồ chơi trẻ em, tai nghe bluetooth.`,
    seeds.length ? `Seed (mở rộng quanh): ${seeds.join(", ")}` : "",
    `Output ONLY: {"keywords":["..."]}`,
  ]
    .filter(Boolean)
    .join("\n");
  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

function parseKeywordsFromText(raw: string): string[] {
  const text = String(raw || "").trim();
  if (!text) return [];
  try {
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const jsonText = fence?.[1]?.trim() || text;
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    const slice = start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText;
    const parsed = JSON.parse(slice);
    const list = Array.isArray(parsed?.keywords) ? parsed.keywords : [];
    return uniqueKeywords(list.map((x: unknown) => String(x)));
  } catch {
    return uniqueKeywords(text.split(/[,;\n]+/));
  }
}

async function suggestViaGateway(input: {
  endpoint: string;
  apiKey: string;
  model?: string;
  seedKeywords: string[];
  minCount: number;
}): Promise<string[]> {
  const res = await fetch("/api/app/scrape-suggest-keywords", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      endpoint: input.endpoint,
      apiKey: input.apiKey,
      model: input.model,
      seedKeywords: input.seedKeywords,
      minCount: input.minCount,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = (json as any)?.message || `Gợi ý từ khóa lỗi HTTP ${res.status}`;
    if (res.status === 401 || res.status === 403) throw new AiAuthError(msg);
    throw new AiApiError(msg);
  }
  const list = Array.isArray((json as any)?.data?.keywords)
    ? (json as any).data.keywords
    : [];
  return uniqueKeywords(list.map((x: unknown) => String(x)));
}

async function suggestViaChatCompletions(input: {
  apiKey: string;
  provider: "openai" | "gemini";
  seedKeywords: string[];
  minCount: number;
}): Promise<string[]> {
  const messages = buildMessages(input.seedKeywords, input.minCount);
  const model = input.provider === "gemini" ? "gemini-2.0-flash" : "gpt-4o-mini";

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
          messages,
          temperature: 0.7,
          response_format: { type: "json_object" },
        }),
      });
      if (!res.ok || !json?.ok) {
        throw new AiApiError(json?.message || `AI lỗi HTTP ${res.status}`);
      }
      return parseKeywordsFromText(String(json.content || ""));
    }
  } catch (err: any) {
    if (err instanceof AiAuthError || err instanceof AiApiError) throw err;
  }

  const base =
    input.provider === "gemini"
      ? "https://generativelanguage.googleapis.com/v1beta/openai"
      : "https://api.openai.com/v1";
  const resp = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
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
  if (!resp.ok) {
    throw new AiApiError(
      json?.error?.message || bodyText.slice(0, 200) || `AI lỗi HTTP ${resp.status}`
    );
  }
  return parseKeywordsFromText(String(json?.choices?.[0]?.message?.content || ""));
}

/**
 * Gợi ý từ khóa Shopee. Chỉ gọi khi caller đã chắc input đang trống (user chưa nhập).
 */
export async function suggestShopeeKeywords(input: {
  openaiKey?: string;
  geminiKey?: string;
  gatewayEndpoint?: string;
  gatewayApiKey?: string;
  gatewayModel?: string;
  seedKeywords?: string[];
  minCount?: number;
}): Promise<{ keywords: string[]; provider: AiProvider }> {
  const minCount = Math.max(MIN_KEYWORDS, Number(input.minCount) || MIN_KEYWORDS);
  const seedKeywords = uniqueKeywords(input.seedKeywords || []);
  const cred = resolveAiApiKey(input.openaiKey, input.geminiKey, {
    endpoint: input.gatewayEndpoint,
    apiKey: input.gatewayApiKey,
    model: input.gatewayModel,
  });

  let keywords: string[] = [];
  if (cred.provider === "gateway") {
    keywords = await suggestViaGateway({
      endpoint: String(cred.endpoint || ""),
      apiKey: cred.apiKey,
      model: cred.model,
      seedKeywords,
      minCount,
    });
  } else {
    keywords = await suggestViaChatCompletions({
      apiKey: cred.apiKey,
      provider: cred.provider,
      seedKeywords,
      minCount,
    });
  }

  if (!keywords.length) {
    throw new AiApiError("AI không trả về từ khóa nào.");
  }
  return { keywords, provider: cred.provider };
}
