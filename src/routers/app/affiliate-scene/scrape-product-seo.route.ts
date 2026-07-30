/**
 * POST /api/app/scrape-product-seo
 * Sinh mô tả SEO + hashtag Shopee từ tên sản phẩm (ChatGPT Flow2 / Gemini).
 */
import { Type } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import {
  callChatGPTGateway,
  callGeminiJsonGenerate,
  checkRequestLimit,
  getChatGPTSceneModel,
  getGeminiSceneModel,
  incrementRequestCount,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
} from "./_shared";

const MAX_PRODUCTS_PER_REQUEST = 50;
const MAX_DESCRIPTION_WORDS = 50;

type ProductSeoInput = {
  id: string;
  name: string;
};

type ProductSeoOutput = {
  id: string;
  description: string;
  hashtags: string[];
};

const GeminiResponseSchema = {
  type: Type.OBJECT,
  properties: {
    products: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          description: { type: Type.STRING },
          hashtags: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
        },
        required: ["id", "description", "hashtags"],
      },
    },
  },
  required: ["products"],
};

const ChatGPTJsonSchema = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          description: { type: "string" },
          hashtags: {
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["id", "description", "hashtags"],
      },
    },
  },
  required: ["products"],
};

function normalizeHashtag(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return "";
  const pascal = cleaned
    .replace(/([a-z])([A-Z])/g, "$1$2")
    .replace(/^[a-z]/, (c) => c.toUpperCase());
  return `#${pascal}`;
}

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

function buildPrompt(products: ProductSeoInput[]): string {
  return `Bạn là chuyên gia SEO nội dung Shopee Affiliate (thị trường Việt Nam).

Nhiệm vụ: Với MỖI sản phẩm trong danh sách, tạo:
1) description — mô tả tiếng Việt NGẮN, dưới 50 chữ (tối đa ${MAX_DESCRIPTION_WORDS} từ, khoảng 1 câu), chuẩn SEO Shopee (lợi ích + CTA "XEM NGAY"), dựa trên tên sản phẩm. CẤM viết dài.
2) hashtags — đúng 4 đến 6 hashtag SEO Shopee:
   - Dạng PascalCase không dấu, bắt đầu bằng #
   - Ví dụ: #DoGiaDung #NhaBepTienIch #MeoVat #DealSoc #ShopeeAffiliate
   - Hashtag phản ánh danh mục / công dụng / từ khóa tìm kiếm phổ biến trên Shopee

CRITICAL OUTPUT: Return ONLY a raw JSON object:
{"products":[{"id":"...","description":"...","hashtags":["#A","#B","#C","#D"]}]}
No markdown, no code fences, no explanation.

Products:
${JSON.stringify(products, null, 2)}`;
}

function normalizeOutputs(
  inputs: ProductSeoInput[],
  parsed: Record<string, unknown>
): ProductSeoOutput[] {
  const rawList = Array.isArray(parsed.products) ? parsed.products : [];
  const byId = new Map<string, { description?: string; hashtags?: unknown }>();

  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const id = String(row.id || "").trim();
    if (!id) continue;
    byId.set(id, {
      description: typeof row.description === "string" ? row.description : "",
      hashtags: row.hashtags,
    });
  }

  return inputs.map((p) => {
    const hit = byId.get(p.id);
    const description =
      clipDescription(String(hit?.description || "").trim()) || fallbackDescription(p.name);
    const tagsRaw = Array.isArray(hit?.hashtags) ? hit!.hashtags! : [];
    const hashtags = tagsRaw
      .map((t) => normalizeHashtag(String(t)))
      .filter(Boolean);
    const unique = Array.from(new Set(hashtags));
    return {
      id: p.id,
      description,
      hashtags: unique.length >= 4 ? unique.slice(0, 6) : fallbackHashtags(p.name),
    };
  });
}

export default [
  {
    method: "post",
    path: "/api/app/scrape-product-seo",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as { products?: ProductSeoInput[] };
        const products = (Array.isArray(body?.products) ? body.products : [])
          .map((p) => ({
            id: String(p?.id || "").trim(),
            name: String(p?.name || "").trim(),
          }))
          .filter((p) => p.id && p.name)
          .slice(0, MAX_PRODUCTS_PER_REQUEST);

        if (!products.length) {
          return res.status(400).json({ message: "Thiếu danh sách sản phẩm (id + name)" });
        }

        await checkRequestLimit(context.id);

        const prompt = buildPrompt(products);
        const aiProvider = await resolveAiSceneProvider();
        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: await getGeminiSceneModel("SUGGEST_CONFIG"),
            text: prompt,
            label: "scrape-product-seo",
            responseSchema: GeminiResponseSchema,
            temperature: 0.5,
          });
        } else {
          responseText = await callChatGPTGateway({
            text: prompt,
            label: "scrape-product-seo",
            model: await getChatGPTSceneModel("SUGGEST_CONFIG"),
            jsonSchema: ChatGPTJsonSchema,
            jsonSchemaName: "scrape_product_seo_response",
            temperature: 0.5,
          });
        }

        const parsed = parseGeminiJsonResponse(responseText);
        const data = normalizeOutputs(products, parsed);

        await incrementRequestCount(context.id);
        return res.json({ success: true, data: { products: data } });
      } catch (err: any) {
        logger.error(`[scrape-product-seo] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        return res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
