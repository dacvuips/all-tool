import { GoogleGenAI } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../constants/role.const";
import logger from "../../helpers/logger";
import { credentialService } from "../../libs/dal/credential";
import { AiProviderKeyEnum } from "../../libs/dal/product";
import { Context } from "../../libs/graphql";
import { decryptProviderSecret } from "../../packages/encryption/encrypt-provider";
import { AffiliateVideoResponseSchema } from "./constanst";

export interface AffiliateVideoFormConfig {
  category: string;
  objectToPersonify: string;
  tipContent: string;
  mood: string;
  language: string;
  artStyle: string;
  storyModeType: "prompt_to_video" | "image_to_video";
  aspectRatio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  batchSize: number;
}

/**
 * Thay thế tất cả placeholder {{fieldName}} trong text bằng giá trị từ config
 */
function interpolateTemplate(text: string, config: AffiliateVideoFormConfig): string {
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = (config as any)[key];
    return value !== undefined && value !== null ? String(value) : match;
  });
}

export default [
  {
    method: "post",
    path: "/api/app/generation-scene/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: AffiliateVideoFormConfig;
          text: string;
        };

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        // Lấy Gemini API key của customer từ credential
        const credentialDoc = (await credentialService.findOne({
          customerId: context.id,
          key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
          isCustomerCredential: true,
        })) as any;
        const credential = credentialDoc?._doc;
        if (!credential?.value) {
          return res.status(403).json({ message: "Chưa cấu hình Google Gemini API Key" });
        }

        const apiKey = decryptProviderSecret(credential.value);
        logger.info("API-key", { apiKey });
        const prompt = `Nhân hóa nhân vật: Dựa trên {{objectToPersonify}}, hãy tạo ra một nhân vật sống động có biểu cảm khuôn mặt, tay chân theo phong cách {{artStyle}}.

Xây dựng nội dung: Chuyển tải {{tipContent}} thông qua một tình huống có mood {{mood}}.

Kỹ thuật Video: Viết {{visualPrompt}} và {{motionPrompt}} bằng tiếng Anh chuyên sâu, tối ưu cho tỉ lệ khung hình {{aspectRatio}} và chế độ storyModeType {{storyModeType}}.

Ngôn ngữ: Toàn bộ lời thoại và chỉ dẫn nội dung phải bằng {{language}}.

Đầu ra (Output): Xuất kết quả duy nhất dưới dạng một JSON Object mới.

`;

        // Thay thế placeholder trong text
        const interpolatedText = interpolateTemplate(body.text || prompt, body.config);

        logger.info(`[generation-scene] Gọi Gemini cho user ${context.id}`);

        const genAI = new GoogleGenAI({ apiKey });

        const result = await genAI.models.generateContent({
          model: "gemini-2.5-flash",
          contents: [{ role: "user", parts: [{ text: interpolatedText }] }],
          config: {
            responseMimeType: "application/json",
            responseSchema: AffiliateVideoResponseSchema as any,
          },
        });

        const responseText = result.text;
        let parsed: any;
        try {
          parsed = JSON.parse(responseText || "{}");
        } catch {
          parsed = { raw: responseText };
        }

        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-scene] Lỗi: ${err?.message}`);
        res.status(500).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
