import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { callChatGPTGateway, callGeminiJsonGenerate, checkRequestLimit, getChatGPTSceneModel, getGeminiSceneModel, parseGeminiJsonResponse, resolveAiSceneProvider } from "./_shared";
import { SuggestConfigOpenAIJsonSchema } from "./_chatgpt.constants";

export default [
  {
    method: "post",
    path: "/api/app/suggest-config/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          category?: string;
          mood?: string;
          language?: string;
        };
        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);

        const categoryHint = body.category ? `Danh mục: ${body.category}` : "Danh mục: tự chọn";
        const moodHint = body.mood ? `Mood/Tính cách: ${body.mood}` : "";
        const languageHint = body.language || "vi";

        const prompt = `Bạn là một chuyên gia sáng tạo nội dung video ngắn trên TikTok/Reels.
Hãy gợi ý một ý tưởng video "mẹo vặt" hấp dẫn, sáng tạo, dễ viral.

${categoryHint}
${moodHint}
Ngôn ngữ: ${languageHint}

Yêu cầu:
1. "objectToPersonify": Một đồ vật / thực phẩm cụ thể để nhân hoá thành nhân vật chính (VD: "Một quả chuối tươi", "Một cuộn giấy vệ sinh", "Một chiếc tất lẻ"). Phải cụ thể, sinh động, dễ hình dung.
2. "tipContent": Nội dung mẹo vặt liên quan đến đồ vật đó (VD: "Cách bảo quản chuối tươi lâu gấp 3 lần", "5 công dụng bất ngờ của lõi giấy vệ sinh"). Phải hấp dẫn, gây tò mò.

Trả về JSON object duy nhất với 2 field trên. Viết bằng ${
          languageHint === "en"
            ? "English"
            : languageHint === "vn" || languageHint === "vi"
            ? "tiếng Việt"
            : languageHint
        }.`;

        logger.info(`[suggest-config] Gọi Gemini cho user ${context.id}`);

        const suggestSchema = {
          type: "object",
          properties: {
            objectToPersonify: { type: "string" },
            tipContent: { type: "string" },
          },
          required: ["objectToPersonify", "tipContent"],
        };

        const aiProvider = await resolveAiSceneProvider();
        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: await getGeminiSceneModel("SUGGEST_CONFIG"),
            text: prompt,
            label: "suggest-config",
            responseSchema: suggestSchema,
          });
        } else {
          responseText = await callChatGPTGateway({
            text: prompt,
            label: "suggest-config",
            model: await getChatGPTSceneModel("SUGGEST_CONFIG"),
            jsonSchema: SuggestConfigOpenAIJsonSchema,
            jsonSchemaName: "suggest_config_response",
          });
        }

        let parsed: any;
        try {
          parsed = parseGeminiJsonResponse(responseText);
        } catch {
          parsed = { raw: responseText };
        }

        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[suggest-config] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
