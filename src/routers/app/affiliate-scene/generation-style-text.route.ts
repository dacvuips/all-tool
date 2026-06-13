import { Type } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";

import { Context } from "../../../libs/graphql";
import { fetchImageAsBase64 } from "../../helpers/handleUploadGoogleLabImages";
import {
  assertNonEmptyTextField,
  callChatGPTGateway,
  callGeminiJsonGenerate,
  checkRequestLimit,
  incrementRequestCount,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
} from "./_shared";
import { GenerationStyleTextOpenAIJsonSchema, CHATGPT_MODELS } from "./_chatgpt.constants";
import { GEMINI_MODELS } from "./_gemini.constants";

// ── Video Analysis Response Schema ─────────────────────────────────────────
const GenerationStyleTextResponseSchema = {
  type: Type.OBJECT,
  properties: {
    text: {
      type: Type.STRING,
      description: "text",
    },
  },
  required: ["text"],
};

export default [
  {
    method: "post",
    path: "/api/app/generate-style-text",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          images?: string[];
          prompt?: string;
        };
        const prompt =
          body.prompt ||
          `
Bạn là chuyên gia Video Production và AI Animation Director. Nhiệm vụ: Phân tích các bức ảnh được gửi lên và từ phân tích ấy hãy tạo cho tôi 1 prompt để tôi có thể điều chỉnh style của hình ảnh theo phong cách của các bức ảnh đó. Quan trọng mô tả thật chi tiết (con người , cảnh vật , đồ vật, con thú , vật phẩm, đường nét, chất liệu, màu sắc, ánh sáng, và tất cả các chi tiết khác) giống với các bức ảnh được gửi lên, mục đích là tạo ra ảnh có phong cách giống như các bức ảnh được gửi lên. kết quả là Prompt tổng thể chi tiết nhất .
Trả về kết quả JSON theo cấu trúc đã định nghĩa.
`;
        if (!body?.images?.length) {
          return res.status(400).json({ message: "Thiếu dữ liệu ảnh tham chiếu" });
        }

        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);

        const productImageUrls = body.images?.filter(Boolean) || [];
        const imageBase64List = await Promise.all(
          productImageUrls.map((url) => fetchImageAsBase64(url))
        );

        const aiProvider = await resolveAiSceneProvider();
        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: GEMINI_MODELS.STYLE_TEXT,
            text: prompt,
            media: imageBase64List,
            label: "generation-style-text",
            responseSchema: GenerationStyleTextResponseSchema,
            temperature: 0.4,
          });
        } else {
          responseText = await callChatGPTGateway({
            text: prompt,
            images: imageBase64List,
            label: "generation-style-text",
            model: CHATGPT_MODELS.STYLE_TEXT,
            jsonSchema: GenerationStyleTextOpenAIJsonSchema,
            jsonSchemaName: "generation_style_text_response",
            temperature: 0.4,
          });
        }
        const parsed = parseGeminiJsonResponse(responseText);
        assertNonEmptyTextField(parsed.text);

        await incrementRequestCount(context.id);
        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-style-text] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
