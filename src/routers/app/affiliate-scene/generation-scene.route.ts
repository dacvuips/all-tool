import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { AffiliateVideoResponseSchema } from "../constanst";
import {
  AffiliateVideoFormConfig,
  callWithKeyRotation,
  getAdminGeminiClients,
  interpolateTemplate,
} from "./_shared";

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

        const clients = await getAdminGeminiClients();

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

        const response = await callWithKeyRotation(
          clients,
          (ai) =>
            ai.models.generateContent({
              model: "gemini-2.5-flash",
              contents: interpolatedText,
              config: {
                responseMimeType: "application/json",
                responseSchema: AffiliateVideoResponseSchema,
              },
            }),
          "generation-scene"
        );

        let parsed: any;
        try {
          parsed = JSON.parse(response.text || "{}");
        } catch {
          parsed = { raw: response.text };
        }

        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-scene] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
