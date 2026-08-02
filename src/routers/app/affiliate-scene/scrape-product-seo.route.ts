/**
 * POST /api/app/scrape-product-seo
 * Sinh mô tả SEO và/hoặc hashtag Shopee từ tên SP.
 * Cách call giống scrape-gio-video-ai (customer endpoint + API key + callChatGPTGateway).
 * Prompt riêng — không dùng prompt lọc Giỏ Video.
 * Body `fields`: "description" | "hashtags" | "both" (mặc định both).
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

const MAX_PRODUCTS_PER_REQUEST = 50;
const MAX_DESCRIPTION_WORDS = 50;

type ProductSeoInput = {
  id: string;
  name: string;
};

type ProductSeoFields = "description" | "hashtags" | "both";

type ProductSeoOutput = {
  id: string;
  description: string;
  hashtags: string[];
};

function normalizeFields(fields?: string): ProductSeoFields {
  if (fields === "description" || fields === "hashtags") return fields;
  return "both";
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

/** Đồng bộ với client `product-seo.ts`. */
function buildSystemPrompt(fields: ProductSeoFields): string {
  const parts = [
    "BẠN LÀ CHUYÊN GIA SEO NỘI DUNG SHOPEE AFFILIATE (THỊ TRƯỜNG VIỆT NAM).",
    "CHỈ TRẢ VỀ JSON THUẦN, KHÔNG GIẢI THÍCH, KHÔNG MARKDOWN.",
    "",
    "NHIỆM VỤ: Với MỖI sản phẩm trong danh sách (có id + name), tạo nội dung đăng Affiliate:",
    "",
  ];
  if (fields === "description" || fields === "both") {
    parts.push(DESCRIPTION_RULES, "");
  }
  if (fields === "hashtags" || fields === "both") {
    parts.push(HASHTAG_RULES, "");
  }

  if (fields === "description") {
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
  } else if (fields === "hashtags") {
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

function buildJsonSchema(fields: ProductSeoFields) {
  const itemProps: Record<string, unknown> = {
    id: { type: "string" },
  };
  const required = ["id"];
  if (fields === "description" || fields === "both") {
    itemProps.description = { type: "string" };
    required.push("description");
  }
  if (fields === "hashtags" || fields === "both") {
    itemProps.hashtags = {
      type: "array",
      items: { type: "string" },
    };
    required.push("hashtags");
  }
  return {
    type: "object",
    properties: {
      products: {
        type: "array",
        items: {
          type: "object",
          properties: itemProps,
          required,
        },
      },
    },
    required: ["products"],
  };
}

function buildUserPrompt(products: ProductSeoInput[], fields: ProductSeoFields): string {
  const lines = products.map((p, i) => {
    const name = String(p.name || "").trim() || "(không tên)";
    return `${i + 1}. id=${p.id} | ${name}`;
  });
  let taskLine: string;
  let listLabel: string;
  if (fields === "description") {
    listLabel = "mô tả";
    taskLine = `Với MỖI SP: tạo description (≤${MAX_DESCRIPTION_WORDS} từ + CTA "XEM NGAY"). Không tạo hashtags.`;
  } else if (fields === "hashtags") {
    listLabel = "hashtag";
    taskLine = "Với MỖI SP: tạo 4–6 hashtags PascalCase. Không tạo description.";
  } else {
    listLabel = "mô tả + hashtag";
    taskLine = `Với MỖI SP: tạo description (≤${MAX_DESCRIPTION_WORDS} từ + CTA "XEM NGAY") và 4–6 hashtags PascalCase.`;
  }
  return [
    `Danh sách sản phẩm cần tạo ${listLabel} SEO Shopee:`,
    ...lines,
    "",
    taskLine,
    "Trả về JSON theo đúng schema đã nêu.",
  ].join("\n");
}

function buildFullPrompt(products: ProductSeoInput[], fields: ProductSeoFields): string {
  return `${buildSystemPrompt(fields)}\n\n${buildUserPrompt(products, fields)}`;
}

function normalizeHashtag(raw: string): string {
  const cleaned = String(raw || "")
    .trim()
    .replace(/^#+/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/gi, "d")
    .replace(/[^a-zA-Z0-9]/g, "");
  if (!cleaned) return "";
  return `#${cleaned.charAt(0).toUpperCase()}${cleaned.slice(1)}`;
}

function clipDescription(text: string): string {
  const words = String(text || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (words.length <= MAX_DESCRIPTION_WORDS) return words.join(" ");
  return words.slice(0, MAX_DESCRIPTION_WORDS).join(" ");
}

/** Chỉ lấy nội dung AI thật — không bịa mô tả/hashtag mẫu. */
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
    const description = clipDescription(String(hit?.description || "").trim());
    const tagsRaw = Array.isArray(hit?.hashtags) ? hit!.hashtags! : [];
    const hashtags = Array.from(
      new Set(tagsRaw.map((t) => normalizeHashtag(String(t))).filter(Boolean))
    ).slice(0, 6);
    return { id: p.id, description, hashtags };
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

        const body = req.body as {
          /** Base URL Flow2 ChatGPT — customer nhập */
          endpoint?: string;
          /** API key Flow2 — customer nhập */
          apiKey?: string;
          model?: string;
          /** "description" | "hashtags" | "both" */
          fields?: string;
          products?: ProductSeoInput[];
        };

        const endpoint = String(body?.endpoint || "").trim();
        const apiKey = String(body?.apiKey || "").trim();
        if (!endpoint || !apiKey) {
          return res.status(400).json({
            message:
              "Thiếu endpoint hoặc API key (customer tự nhập, không dùng key hệ thống).",
          });
        }

        const fields = normalizeFields(body?.fields);
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

        const model = String(body?.model || "").trim() || DEFAULT_CHATGPT_MODEL;
        const prompt = buildFullPrompt(products, fields);
        const responseText = await callChatGPTGateway({
          text: prompt,
          label: "scrape-product-seo",
          model,
          jsonSchema: buildJsonSchema(fields),
          jsonSchemaName: "scrape_product_seo_response",
          temperature: 0.5,
          baseUrl: endpoint,
          apiKey,
        });

        const parsed = parseGeminiJsonResponse(responseText);
        const data = normalizeOutputs(products, parsed);

        await incrementRequestCount(context.id);
        return res.json({
          success: true,
          data: {
            products: data,
            provider: "gateway",
            model,
            fields,
            rawText: responseText,
          },
        });
      } catch (err: any) {
        logger.error(`[scrape-product-seo] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        return res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
