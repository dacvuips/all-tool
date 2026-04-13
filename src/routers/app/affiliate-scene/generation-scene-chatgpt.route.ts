import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { AffiliateVideoResponseSchema } from "../constanst";
import {
  AffiliateVideoFormConfig,
  getCustomerOpenAIKey,
  interpolateTemplate,
  retryAICall,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-scene-chatgpt/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: AffiliateVideoFormConfig;
          text: string;
          model?: string;
        };

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        const openaiKey = await getCustomerOpenAIKey(context.id);

        const prompt = `


Character Anchor: Trước khi viết các scene, hãy xác định một mô tả cố định cho nhân vật nhân hóa từ {{objectToPersonify}}.
Mô tả cố định ({{character_fixed_description}}): Phải bao gồm chi tiết khuôn mặt, tay chân, hình thể, trang phục đặc trưng và màu sắc chủ đạo theo phong cách {{artStyle}}.

Environment Anchor: Xác định một bối cảnh (background) duy nhất phù hợp với chủ đề {{category}}. Bối cảnh này phải giữ nguyên các vật dụng chính, ánh sáng và tông màu qua tất cả các scene.

Ngôn ngữ Prompt: Viết visualPrompt, motionPrompt và imagePrompt bằng tiếng Anh chuyên sâu.

Cấu trúc bắt buộc: Mọi prompt trong từng scene đều PHẢI bắt đầu bằng đoạn mô tả {{character_fixed_description}} để đảm bảo nhân vật không bị biến đổi.

Tối ưu hóa: Tỉ lệ khung hình {{aspectRatio}}, chế độ {{storyModeType}}, chuẩn nét nhân vật (High-definition, consistent character design).

Tính nhất quán: Image prompt và video prompt trong cùng một scene phải mô tả cùng một hành động và cùng một nhân vật.

Cấm: Không chứa bất kỳ chữ viết (text/watermark) nào trong hình ảnh và video.

Ngôn ngữ: Toàn bộ lời thoại và chỉ dẫn nội dung phải bằng {{language}}.
            
Audio: Giới tính {{gender}}, giọng {{mood}} đồng bộ với lời thoại ở tất cả các scene.
`;

        // Thay thế placeholder trong text
        const interpolatedText = interpolateTemplate(body.text || prompt, body.config);

        // Xây dựng system prompt yêu cầu trả về JSON theo schema
        const systemPrompt = `You are a professional video scene generation assistant. You MUST respond with valid JSON only, no markdown, no explanation, no code block.
The JSON response MUST strictly follow this schema:
${JSON.stringify(AffiliateVideoResponseSchema, null, 2)}

Required top-level fields: "topicTitle", "characterBaseDescription", "scenes".
Each scene must have: "sceneNumber", "visualPrompt", "imageGenPrompt", "motionPrompt", "dialogue".`;

        const model = body.model || "gpt-4o";

        logger.info(`[generation-scene-chatgpt] Gọi ChatGPT (${model}) cho user ${context.id}`);
        console.log(interpolatedText);

        const url = "https://api.openai.com/v1/chat/completions";

        const result = await retryAICall(async () => {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${openaiKey}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: interpolatedText },
              ],
              response_format: { type: "json_object" },
              temperature: 0.7,
            }),
          });

          if (!response.ok) {
            const errText = await response.text();
            const err: any = new Error(`ChatGPT API error ${response.status}: ${errText}`);
            err.statusCode = response.status;
            throw err;
          }

          return response.json();
        }, "generation-scene-chatgpt");

        const responseText = result?.choices?.[0]?.message?.content;
        let parsed: any;
        try {
          parsed = JSON.parse(responseText || "{}");
        } catch {
          parsed = { raw: responseText };
        }

        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-scene-chatgpt] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
