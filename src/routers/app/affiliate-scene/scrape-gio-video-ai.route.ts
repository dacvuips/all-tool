/**
 * POST /api/app/scrape-gio-video-ai
 * Lọc SP tương tự theo tên qua Flow2 ChatGPT (customer tự nhập endpoint + API key).
 * Cách call giống `ai-scene-more` / callChatGPTGateway — không dùng key hệ thống.
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

const MAX_SIMILAR_ITEMS = 80;

type SimilarItemInput = {
  id: string;
  name: string;
};

/** Đồng bộ với PeeCrawl prompt ở client `gio-video-ai.ts`. */
const PEECRAWL_SYSTEM_PROMPT = `BẠN LÀ MÁY ĐỐI CHIẾU SẢN PHẨM CỰC KỲ KHẮT KHE. CHỈ TRẢ VỀ JSON, KHÔNG GIẢI THÍCH.

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

BẮT BUỘC: Output PHẢI là JSON thuần, NGẮN GỌN, KHÔNG kèm lý do:
{
  "matched_items": [
    {"id": "itemid", "confidence": 0.95}
  ],
  "summary": "X/Y sản phẩm trùng hãng+dòng"
}
Nếu không có SP nào đạt: matched_items = [].`;

const ChatGPTJsonSchema = {
  type: "object",
  properties: {
    matched_items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["id", "confidence"],
      },
    },
    summary: { type: "string" },
  },
  required: ["matched_items", "summary"],
};

function buildUserPrompt(originalName: string, similarItems: SimilarItemInput[]): string {
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

function buildFullPrompt(originalName: string, similarItems: SimilarItemInput[]): string {
  return `${PEECRAWL_SYSTEM_PROMPT}\n\n${buildUserPrompt(originalName, similarItems)}`;
}

function normalizeMatchedItems(parsed: Record<string, unknown>): {
  matchedItems: Array<{ id: string; confidence: number }>;
  summary: string;
} {
  const list = Array.isArray(parsed.matched_items)
    ? parsed.matched_items
    : Array.isArray(parsed.matchedItems)
      ? parsed.matchedItems
      : [];
  const matchedItems: Array<{ id: string; confidence: number }> = [];
  for (const row of list) {
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const id = String(r.id ?? r.item_id ?? r.itemId ?? "").trim();
    const confidence = Number(r.confidence);
    if (!id) continue;
    if (!Number.isFinite(confidence) || confidence < 0.9) continue;
    matchedItems.push({ id, confidence });
  }
  return {
    matchedItems,
    summary: String(parsed.summary || "").trim(),
  };
}

export default [
  {
    method: "post",
    path: "/api/app/scrape-gio-video-ai",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          originalName?: string;
          similarItems?: SimilarItemInput[];
          /** Base URL Flow2 ChatGPT — customer nhập (vd https://flow2.viettheo.site) */
          endpoint?: string;
          /** API key Flow2 (`f2api_...`) — customer nhập */
          apiKey?: string;
          model?: string;
        };

        const endpoint = String(body?.endpoint || "").trim();
        const apiKey = String(body?.apiKey || "").trim();
        if (!endpoint || !apiKey) {
          return res.status(400).json({
            message: "Thiếu endpoint hoặc API key (customer tự nhập, không dùng key hệ thống).",
          });
        }

        const originalName = String(body?.originalName || "").trim();
        const similarItems = (Array.isArray(body?.similarItems) ? body.similarItems : [])
          .map((s) => ({
            id: String(s?.id || "").trim(),
            name: String(s?.name || "").trim(),
          }))
          .filter((s) => s.id)
          .slice(0, MAX_SIMILAR_ITEMS);

        if (!similarItems.length) {
          return res.json({
            success: true,
            data: {
              matchedItems: [],
              summary: "0/0 — không có SP tương tự",
              provider: "gateway",
              model: "",
            },
          });
        }

        await checkRequestLimit(context.id);

        const model = String(body?.model || "").trim() || DEFAULT_CHATGPT_MODEL;
        const prompt = buildFullPrompt(originalName, similarItems);
        const responseText = await callChatGPTGateway({
          text: prompt,
          label: "scrape-gio-video-ai",
          model,
          jsonSchema: ChatGPTJsonSchema,
          jsonSchemaName: "scrape_gio_video_ai_response",
          temperature: 0,
          baseUrl: endpoint,
          apiKey,
        });

        const parsed = parseGeminiJsonResponse(responseText);
        const { matchedItems, summary } = normalizeMatchedItems(parsed);

        await incrementRequestCount(context.id);
        return res.json({
          success: true,
          data: {
            matchedItems,
            summary,
            provider: "gateway",
            model,
            rawText: responseText,
          },
        });
      } catch (err: any) {
        logger.error(`[scrape-gio-video-ai] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        return res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
