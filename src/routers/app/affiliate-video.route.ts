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
    return value !== undefined && value !== null ? `"${String(value)}"` : "";
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
        console.log(body, body?.config?.batchSize);

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
        const prompt = `

Xây dựng nội dung: Chuyển tải {{tipContent}} thông qua một tình huống có mood {{mood}}.

Kỹ thuật Video: Viết visualPrompt và motionPrompt bằng tiếng Anh chuyên sâu, tối ưu cho tỉ lệ khung hình {{aspectRatio}} và chế độ {{storyModeType}}, chuẩn nét nhân vật,luôn mô tả chi tiết nhân vật tại những nơi {{objectToPersonify}} xuất hiện trong, nhân hóa nhân vật: Dựa trên {{objectToPersonify}}, hãy tạo ra một nhân vật sống động có biểu cảm khuôn mặt, tay chân theo phong cách {{artStyle}}.
Kỹ thuật Image Prompt: Viết {{imagePrompt}} bằng tiếng Anh chuyên sâu, tối ưu cho tỉ lệ khung hình {{aspectRatio}} và chế độ {{storyModeType}}, chuẩn nét nhân vật,luôn mô tả chi tiết nhân vật tại những nơi {{objectToPersonify}} xuất hiện trong, nhân hóa nhân vật: Dựa trên {{objectToPersonify}}, hãy tạo ra một nhân vật sống động có biểu cảm khuôn mặt, tay chân theo phong cách {{artStyle}}.

Ngôn ngữ: Toàn bộ lời thoại và chỉ dẫn nội dung phải bằng {{language}}.
Audio từng phân cảnh: giới tính {{gender}}, giọng {{voice}}

Đầu ra (Output): Xuất kết quả duy nhất dưới dạng một JSON Object mới.
Quang trọng: Image prompt và video prompt phải luôn mô tả chi tiết nhân vật tại những nơi {{objectToPersonify}}, phải đồng nhất được nhân vật qua các phân cảnh. Trong Image prompt và video prompt phải đồng nhất nhân vật giữa 2 prompt. Không chứa text trong image prompt và video prompt.
 
Scenes array must contain exactly ${
          body?.config?.batchSize > 1 ? `{{batchSize}}` : 5
        } objects. Each object must follow the defined schema

`;

        // Thay thế placeholder trong text
        const interpolatedText = interpolateTemplate(body.text || prompt, body.config);

        logger.info(`[generation-scene] Gọi Gemini cho user ${context.id}`);
        console.log(interpolatedText);
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
  {
    method: "post",
    path: "/api/app/generation-image/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          config?: {
            numberOfImages?: number;
            aspectRatio?: string;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
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
        const genAI = new GoogleGenAI({ apiKey });

        logger.info(`[generation-image] Gọi Imagen cho user ${context.id}`);

        const response = await genAI.models.generateImages({
          model: "imagen-3.0-generate-002",
          prompt: body.prompt,
          config: {
            numberOfImages: body.config?.numberOfImages || 1,
            aspectRatio: body.config?.aspectRatio || "1:1",
          },
        });

        const images = (response.generatedImages || []).map((img: any) => ({
          imageBytes: img.image?.imageBytes,
          mimeType: img.image?.mimeType || "image/png",
        }));

        res.json({ success: true, data: images });
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi: ${err?.message}`);
        res.status(500).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
  {
    method: "post",
    path: "/api/app/generation-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          image?: { imageBytes: string; mimeType: string };
          config?: {
            aspectRatio?: string;
            generateAudio?: boolean;
          };
        };

        if (!body?.prompt) {
          return res.status(400).json({ message: "Thiếu prompt" });
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
        const genAI = new GoogleGenAI({ apiKey });

        logger.info(`[generation-video] Gọi Veo 3.1 fast cho user ${context.id}`);

        // Setup SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendSSE({ type: "progress", progress: 5, message: "Đang khởi tạo..." });

        // Build request – support both text-to-video and image-to-video
        const generateConfig: any = {
          aspectRatio: body.config?.aspectRatio || "9:16",
          generateAudio: body.config?.generateAudio ?? true,
        };

        const generateParams: any = {
          model: "veo-3.1-fast-generate-001",
          prompt: body.prompt,
          config: generateConfig,
        };

        // If an image is provided, attach it as reference for image-to-video
        if (body.image?.imageBytes) {
          generateParams.image = {
            imageBytes: body.image.imageBytes,
            mimeType: body.image.mimeType || "image/png",
          };
        }

        let operation = await genAI.models.generateVideos(generateParams);

        sendSSE({ type: "progress", progress: 15, message: "Đã gửi yêu cầu, đang chờ xử lý..." });

        // Poll until done
        const MAX_POLLS = 120; // max ~30 minutes (15s * 120)
        let pollCount = 0;
        while (!operation.done && pollCount < MAX_POLLS) {
          await new Promise((resolve) => setTimeout(resolve, 15000)); // 15s interval
          pollCount++;

          // Simulate progress: 15% → 90% linearly over polls
          const progress = Math.min(15 + Math.round((pollCount / MAX_POLLS) * 75), 90);
          sendSSE({
            type: "progress",
            progress,
            message: `Đang tạo video... (${pollCount * 15}s)`,
          });

          try {
            operation = await genAI.operations.get({ operation: operation as any });
          } catch (pollErr: any) {
            logger.warn(`[generation-video] Poll error: ${pollErr?.message}`);
          }
        }

        if (!operation.done) {
          sendSSE({ type: "error", message: "Quá thời gian chờ tạo video" });
          res.end();
          return;
        }

        sendSSE({ type: "progress", progress: 95, message: "Đang lấy kết quả..." });

        const generatedVideos = (operation as any).response?.generatedVideos || [];
        if (generatedVideos.length === 0) {
          sendSSE({ type: "error", message: "Không nhận được video từ API" });
          res.end();
          return;
        }

        const video = generatedVideos[0].video;
        sendSSE({
          type: "done",
          progress: 100,
          data: {
            videoUri: video?.uri || null,
            mimeType: video?.mimeType || "video/mp4",
          },
        });
        res.end();
      } catch (err: any) {
        logger.error(`[generation-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
          );
          res.end();
        } else {
          res.status(500).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
];
