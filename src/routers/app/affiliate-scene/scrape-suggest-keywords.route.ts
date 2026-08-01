/**
 * POST /api/app/scrape-suggest-keywords
 * Gợi ý ≥200 từ khóa tìm kiếm Shopee Affiliate (customer endpoint + API key).
 */
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callChatGPTGateway,
  checkRequestLimit,
  DEFAULT_CHATGPT_MODEL,
  incrementRequestCount,
  parseGeminiJsonResponse,
} from "./_shared";

const MIN_KEYWORDS = 200;
const MAX_KEYWORDS = 400;

const ChatGPTJsonSchema = {
  type: "object",
  properties: {
    keywords: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: ["keywords"],
};

function normalizeKeyword(raw: string): string {
  return String(raw || "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,;]+|[,;]+$/g, "");
}

function uniqueKeywords(list: string[]): string[] {
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

function buildPrompt(seedKeywords: string[], need: number): string {
  const seeds = uniqueKeywords(seedKeywords);
  return `Bạn là chuyên gia SEO / Affiliate Marketing trên Shopee Việt Nam.

Nhiệm vụ: Tạo danh sách TỪ KHÓA TÌM KIẾM sản phẩm chuẩn trên Shopee (tiếng Việt), dùng để scrape offer.

Yêu cầu:
- Trả về ÍT NHẤT ${need} từ khóa (tối đa ${MAX_KEYWORDS}).
- Mỗi từ khóa ngắn gọn (1–5 từ), dạng người dùng hay search trên Shopee.
- Đa dạng danh mục: thời trang nam/nữ, mẹ và bé, đồ chơi, điện tử, nhà cửa, làm đẹp, thể thao, phụ kiện, thực phẩm, thú cưng, văn phòng phẩm...
- Ví dụ đúng kiểu: "đồ nam", "mẹ và bé", "đồ chơi trẻ em", "tai nghe bluetooth", "nồi chiên không dầu".
- KHÔNG trùng lặp, KHÔNG hashtag, KHÔNG giải thích.
${seeds.length ? `- Ưu tiên mở rộng quanh các từ khóa seed (không bắt buộc giữ nguyên): ${seeds.join(", ")}` : ""}

CRITICAL OUTPUT: Return ONLY raw JSON:
{"keywords":["từ khóa 1","từ khóa 2",...]}
No markdown, no code fences.`;
}

export default [
  {
    method: "post",
    path: "/api/app/scrape-suggest-keywords",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          endpoint?: string;
          apiKey?: string;
          model?: string;
          seedKeywords?: string[];
          minCount?: number;
        };

        const endpoint = String(body?.endpoint || "").trim();
        const apiKey = String(body?.apiKey || "").trim();
        if (!endpoint || !apiKey) {
          return res.status(400).json({
            message: "Thiếu endpoint hoặc API key để gợi ý từ khóa.",
          });
        }

        const minCount = Math.max(
          MIN_KEYWORDS,
          Math.min(MAX_KEYWORDS, Number(body?.minCount) || MIN_KEYWORDS)
        );
        const seedKeywords = Array.isArray(body?.seedKeywords) ? body.seedKeywords : [];
        const model = String(body?.model || "").trim() || DEFAULT_CHATGPT_MODEL;

        await checkRequestLimit(context.id);

        const prompt = buildPrompt(seedKeywords, minCount);
        const responseText = await callChatGPTGateway({
          text: prompt,
          label: "scrape-suggest-keywords",
          model,
          jsonSchema: ChatGPTJsonSchema,
          jsonSchemaName: "scrape_suggest_keywords_response",
          temperature: 0.7,
          baseUrl: endpoint,
          apiKey,
        });

        const parsed = parseGeminiJsonResponse(responseText);
        const rawList = Array.isArray(parsed.keywords) ? parsed.keywords : [];
        const keywords = uniqueKeywords(rawList.map((x) => String(x))).slice(0, MAX_KEYWORDS);

        await incrementRequestCount(context.id);
        return res.json({
          success: true,
          data: {
            keywords,
            model,
            count: keywords.length,
          },
        });
      } catch (err: any) {
        logger.error(`[scrape-suggest-keywords] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        return res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
