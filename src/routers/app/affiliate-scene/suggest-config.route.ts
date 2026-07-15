import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { SuggestConfigOpenAIJsonSchema } from "./_chatgpt.constants";
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

        await checkRequestLimit(context.id);

        const categoryHint = body.category ? `Danh mục: ${body.category}` : "Danh mục: tự chọn";
        const moodHint = body.mood ? `Mood/Tính cách: ${body.mood}` : "";
        const languageHint = body.language || "vi";
        const outputLanguage =
          languageHint === "en"
            ? "English"
            : languageHint === "vn" || languageHint === "vi"
              ? "tiếng Việt"
              : languageHint;

        const prompt = `Bạn là một chuyên gia sáng tạo nội dung video ngắn trên TikTok/Reels.
Hãy gợi ý một ý tưởng video "mẹo vặt" hấp dẫn, sáng tạo, dễ viral.

${categoryHint}
${moodHint}
Ngôn ngữ: ${languageHint}

Yêu cầu:
1. "objectToPersonify": Một đồ vật / thực phẩm cụ thể để nhân hoá thành nhân vật chính (VD: "Một quả chuối tươi", "Một cuộn giấy vệ sinh", "Một chiếc tất lẻ"). Phải cụ thể, sinh động, dễ hình dung.
2. "tipContent": Nội dung mẹo vặt liên quan đến đồ vật đó (VD: "Cách bảo quản chuối tươi lâu gấp 3 lần", "5 công dụng bất ngờ của lõi giấy vệ sinh"). Phải hấp dẫn, gây tò mò.

CRITICAL: Return ONLY a raw JSON object with exactly these keys: objectToPersonify, tipContent.
No markdown, no code fences, no explanation, no extra text.
Write field values in ${outputLanguage}.`;

        const aiProvider = await resolveAiSceneProvider();
        logger.info(`[suggest-config] Gọi ${aiProvider} cho user ${context.id}`);

        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: await getGeminiSceneModel("SUGGEST_CONFIG"),
            text: prompt,
            label: "suggest-config",
            responseSchema: SuggestConfigOpenAIJsonSchema,
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

        const parsed = parseGeminiJsonResponse(responseText) as {
          objectToPersonify?: string;
          tipContent?: string;
        };

        const objectToPersonify = String(parsed.objectToPersonify || "").trim();
        const tipContent = String(parsed.tipContent || "").trim();
        if (!objectToPersonify || !tipContent) {
          const err: any = new Error("AI trả JSON thiếu objectToPersonify hoặc tipContent");
          err.statusCode = 502;
          throw err;
        }

        await incrementRequestCount(context.id);
        res.json({
          success: true,
          data: { objectToPersonify, tipContent },
        });
      } catch (err: any) {
        logger.error(`[suggest-config] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
