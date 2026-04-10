import { GoogleGenAI } from "@google/genai";
import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../constants/role.const";
import logger from "../../helpers/logger";
import { credentialService } from "../../libs/dal/credential";
import { CustomerModel } from "../../libs/dal/customer";
import { AiProviderKeyEnum } from "../../libs/dal/product";
import { Context } from "../../libs/graphql";
import { decryptProviderSecret } from "../../packages/encryption/encrypt-provider";
import { AffiliateVideoResponseSchema } from "./constanst";

const AI_MAX_RETRIES = 5;

/**
 * Helper: Gọi lại AI API tối đa AI_MAX_RETRIES lần nếu có lỗi.
 * Chỉ throw error nếu tất cả các lần gọi đều thất bại.
 */
async function retryAICall<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= AI_MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      logger.warn(
        `[${label}] AI call failed (attempt ${attempt}/${AI_MAX_RETRIES}): ${err?.message}`
      );
      if (attempt === AI_MAX_RETRIES) {
        break;
      }
      // Wait before retrying (exponential backoff: 1s, 2s, 4s, 8s)
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

/** Helper: Tạo GoogleGenAI client dùng Vertex AI */
function createVertexAIClient(serviceAccountKeyJson: string, location = "us-central1") {
  // Parse service account key JSON
  let credentials: any;
  try {
    credentials = JSON.parse(serviceAccountKeyJson);
  } catch {
    throw new Error(
      "Credential không hợp lệ: Vui lòng cung cấp Service Account Key JSON cho Vertex AI."
    );
  }

  // Dùng Vertex AI backend với service account credentials
  return new GoogleGenAI({
    vertexai: true,
    project: credentials.project_id || "vertex-ai-app-490903",
    location,
    googleAuthOptions: {
      credentials,
    },
  });
}

/**
 * Helper chung: Lấy credential Gemini của customer, giải mã và tạo GoogleGenAI client.
 * Throw error nếu chưa cấu hình key.
 */
export async function getCustomerGeminiClient(
  customerId: string,
  location = "us-central1"
): Promise<InstanceType<typeof GoogleGenAI>> {
  const credentialDoc = (await credentialService.findOne({
    customerId,
    key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
    isCustomerCredential: true,
  })) as any;
  const credential = credentialDoc?._doc;
  if (!credential?.value) {
    const err: any = new Error("Chưa cấu hình Google Gemini API Key");
    err.statusCode = 403;
    throw err;
  }
  const apiKey = decryptProviderSecret(credential.value);
  return createVertexAIClient(apiKey, location);
}

/**
 * Kiểm tra giới hạn ảnh của customer. Throw error 403 nếu vượt quá.
 */
async function checkImageLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.imageCount googlePackage.imageLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.imageCount || 0;
  const limit = customer.googlePackage?.imageLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn ảnh (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

/**
 * Kiểm tra giới hạn video của customer. Throw error 403 nếu vượt quá.
 */
async function checkVideoLimit(customerId: string): Promise<void> {
  const customer = await CustomerModel.findById(customerId)
    .select("googlePackage.videoCount googlePackage.videoLimit")
    .lean();
  if (!customer) {
    const err: any = new Error("Không tìm thấy thông tin khách hàng");
    err.statusCode = 404;
    throw err;
  }
  const currentCount = customer.googlePackage?.videoCount || 0;
  const limit = customer.googlePackage?.videoLimit || 0;
  if (currentCount + 1 > limit) {
    const err: any = new Error(
      `Bạn đã vượt quá giới hạn video (${currentCount}/${limit}). Vui lòng nâng cấp gói để tiếp tục.`
    );
    err.statusCode = 403;
    throw err;
  }
}

/** Tăng imageCount lên 1 sau khi tạo ảnh thành công */
async function incrementImageCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.imageCount": 1 } });
}

/** Tăng videoCount lên 1 sau khi tạo video thành công */
async function incrementVideoCount(customerId: string): Promise<void> {
  await CustomerModel.findByIdAndUpdate(customerId, { $inc: { "googlePackage.videoCount": 1 } });
}

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

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        const genAI = await getCustomerGeminiClient(context.id);

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

        logger.info(`[generation-scene] Gọi Gemini cho user ${context.id}`);
        console.log(interpolatedText);

        const result = await retryAICall(
          () =>
            genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: interpolatedText }] }],
              config: {
                responseMimeType: "application/json",
                responseSchema: AffiliateVideoResponseSchema as any,
              },
            }),
          "generation-scene"
        );

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
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
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

        // Kiểm tra giới hạn ảnh trước khi tạo
        await checkImageLimit(context.id);

        const genAI = await getCustomerGeminiClient(context.id, "global");

        logger.info(
          `[generation-image] Gọi Banana 2 (gemini-3.1-flash-image-preview) cho user ${context.id}`
        );

        const response = await retryAICall(
          () =>
            genAI.models.generateContent({
              model: "gemini-3.1-flash-image-preview",
              contents: [{ role: "user", parts: [{ text: body.prompt }] }],
              config: {
                responseModalities: ["IMAGE"],
              } as any,
            }),
          "generation-image"
        );

        // Extract images from response candidate parts
        const parts = (response as any).candidates?.[0]?.content?.parts || [];
        const images = parts
          .filter((part: any) => part.inlineData)
          .map((part: any) => ({
            imageBytes: part.inlineData.data,
            mimeType: part.inlineData.mimeType || "image/png",
          }));

        // Tạo ảnh thành công → tăng imageCount
        await incrementImageCount(context.id);

        res.json({ success: true, data: images });
      } catch (err: any) {
        logger.error(`[generation-image] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
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

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);

        const genAI = await getCustomerGeminiClient(context.id);

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

        // Sử dụng Vertex AI với Veo 3.1 Fast (lower priority / lower cost tier)
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

        let operation = await retryAICall(
          () => genAI.models.generateVideos(generateParams),
          "generation-video"
        );

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
            operation = await genAI.operations.getVideosOperation({ operation: operation as any });
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

        // Log full response for debugging

        const generatedVideos = (operation as any).response?.generatedVideos || [];
        if (generatedVideos.length === 0) {
          sendSSE({ type: "error", message: "Không nhận được video từ API" });
          res.end();
          return;
        }

        const video = generatedVideos[0].video;
        // API trả về videoBytes (base64) khi không có outputGcsUri, hoặc uri khi có GCS
        const videoUri = video?.uri || null;
        const videoBytes = video?.videoBytes || null;

        // Tạo video thành công → tăng videoCount
        await incrementVideoCount(context.id);

        sendSSE({
          type: "done",
          progress: 100,
          data: {
            videoUri,
            videoBytes,
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
          const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
  {
    method: "post",
    path: "/api/app/insert-scene/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          description: string;
          cast?: { name: string; tag: string; description: string }[];
          environment?: string;
          artStyle?: string;
          audioPrompt?: string;
          voiceGender?: string;
          voiceTone?: string;
          language?: string;
          prevScene?: any;
          nextScene?: any;
          sceneNumber: number;
          characterDna?: string;
          camera?: string;
          voiceover?: string;
        };

        if (!body?.description) {
          return res.status(400).json({ message: "Thiếu description cho scene mới" });
        }

        const genAI = await getCustomerGeminiClient(context.id);

        // Build context prompt
        const prevSceneInfo = body.prevScene
          ? `\nScene trước (Scene #${body.prevScene.sceneNumber}):\n- Camera: ${body.prevScene.camera}\n- Visual: ${body.prevScene.visualPrompt}\n- Motion: ${body.prevScene.motionPrompt}\n- Dialogue: ${body.prevScene.dialogue}\n`
          : "";

        const nextSceneInfo = body.nextScene
          ? `\nScene sau (Scene #${body.nextScene.sceneNumber}):\n- Camera: ${body.nextScene.camera}\n- Visual: ${body.nextScene.visualPrompt}\n- Motion: ${body.nextScene.motionPrompt}\n- Dialogue: ${body.nextScene.dialogue}\n`
          : "";

        const castInfo = body.cast?.length
          ? `\nCast: ${body.cast.map((c) => `${c.name} (${c.tag}) - ${c.description}`).join(", ")}`
          : "";

        const characterDnaInfo = body.characterDna
          ? `\nCharacter DNA (mô tả chi tiết ngoại hình nhân vật): ${body.characterDna}`
          : "";

        const prompt = `Bạn là chuyên gia tạo kịch bản video AI. Hãy tạo 1 scene mới dựa trên ngữ cảnh sau:

Mô tả scene cần tạo: ${body.description}
${body.voiceover ? `Lời thoại/voiceover gợi ý: ${body.voiceover}` : ""}
Scene number: ${body.sceneNumber}
Camera yêu cầu: ${body.camera || "Tự chọn phù hợp"}
${castInfo}
${characterDnaInfo}
Environment: ${body.environment || "Tự chọn phù hợp"}
Art Style: ${body.artStyle || "pixar"}
Audio Prompt: ${body.audioPrompt || ""}
Voice Gender: ${body.voiceGender || ""}
Voice Tone: ${body.voiceTone || ""}
Language: ${body.language || "vi"}
${prevSceneInfo}
${nextSceneInfo}

Yêu cầu:
1. Scene mới phải LIÊN KẾT mượt mà với scene trước và scene sau (nếu có)
2. ImagePrompt phải bao gồm: [camera angle] + mô tả nội dung + Setting + art style + chất lượng (9:16, 4k, realistic textures but cartoon proportions, vibrant colors, expressive lighting)
3. MotionPrompt mô tả chuyển động camera và nhân vật chi tiết
4. VisualPrompt mô tả trực quan scene
5. Audio prompt bao gồm [SFX], [MUSIC], (Voice info), [DIALOGUE]
6. Dialogue bằng ${body.language || "vi"}, phù hợp mood và character
7. Luôn mô tả chi tiết nhân vật (DNA) trong imagePrompt và visualPrompt
8. Tất cả prompt bằng tiếng Anh, chỉ dialogue bằng ngôn ngữ ${body.language || "vi"}

Trả về JSON object duy nhất.`;

        logger.info(`[insert-scene] Gọi Gemini cho user ${context.id}`);

        const insertSceneSchema = {
          type: "object",
          properties: {
            sceneNumber: { type: "integer" },
            imagePrompt: { type: "string" },
            motionPrompt: { type: "string" },
            visualPrompt: { type: "string" },
            audio: { type: "string" },
            camera: { type: "string" },
            dialogue: { type: "string" },
          },
          required: [
            "sceneNumber",
            "imagePrompt",
            "motionPrompt",
            "visualPrompt",
            "audio",
            "camera",
            "dialogue",
          ],
        };

        const result = await retryAICall(
          () =>
            genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              config: {
                responseMimeType: "application/json",
                responseSchema: insertSceneSchema as any,
              },
            }),
          "insert-scene"
        );

        const responseText = result.text;
        let parsed: any;
        try {
          parsed = JSON.parse(responseText || "{}");
        } catch {
          parsed = { raw: responseText };
        }

        // Ensure sceneNumber is set
        if (!parsed.sceneNumber) {
          parsed.sceneNumber = body.sceneNumber;
        }

        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[insert-scene] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
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

        const genAI = await getCustomerGeminiClient(context.id);

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

        const result = await retryAICall(
          () =>
            genAI.models.generateContent({
              model: "gemini-2.5-flash",
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              config: {
                responseMimeType: "application/json",
                responseSchema: suggestSchema as any,
              },
            }),
          "suggest-config"
        );

        const responseText = result.text;
        let parsed: any;
        try {
          parsed = JSON.parse(responseText || "{}");
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
  {
    method: "post",
    path: "/api/app/extend-video/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          prompt: string;
          video?: { uri?: string; videoBytes?: string; mimeType?: string };
          image?: { imageBytes: string; mimeType: string };
          config?: {
            aspectRatio?: string;
            generateAudio?: boolean;
          };
        };

        if (!body?.video) {
          return res.status(400).json({ message: "Thiếu video gốc để nối tiếp" });
        }

        // Kiểm tra giới hạn video trước khi tạo
        await checkVideoLimit(context.id);

        const genAI = await getCustomerGeminiClient(context.id);

        logger.info(`[extend-video] Gọi Veo 3.1 (extend mode) cho user ${context.id}`);

        // Setup SSE headers
        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.flushHeaders();

        const sendSSE = (data: any) => {
          res.write(`data: ${JSON.stringify(data)}\n\n`);
        };

        sendSSE({ type: "progress", progress: 5, message: "Đang khởi tạo extend video..." });

        // Build config
        const generateConfig: any = {
          aspectRatio: body.config?.aspectRatio || "9:16",
          generateAudio: body.config?.generateAudio ?? true,
        };

        // Nếu có ảnh tham chiếu → thêm vào config.referenceImages
        if (body.image?.imageBytes) {
          generateConfig.referenceImages = [
            {
              image: {
                imageBytes: body.image.imageBytes,
                mimeType: body.image.mimeType || "image/png",
              },
              referenceType: "asset",
            },
          ];
        }

        // Use Veo 3.1 (non-fast) for extend mode
        const finalPrompt = body.prompt?.trim() || "Continue the scene naturally";

        const generateParams: any = {
          model: "veo-3.1-generate-001",
          prompt: finalPrompt,
          config: generateConfig,
          video: body.video,
        };

        let operation = await retryAICall(
          () => genAI.models.generateVideos(generateParams),
          "extend-video"
        );

        sendSSE({
          type: "progress",
          progress: 15,
          message: "Đã gửi yêu cầu extend, đang chờ xử lý...",
        });

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
            message: `Đang nối video... (${pollCount * 15}s)`,
          });

          try {
            operation = await genAI.operations.getVideosOperation({ operation: operation as any });
          } catch (pollErr: any) {
            logger.warn(`[extend-video] Poll error: ${pollErr?.message}`);
          }
        }

        if (!operation.done) {
          sendSSE({ type: "error", message: "Quá thời gian chờ nối video" });
          res.end();
          return;
        }

        sendSSE({ type: "progress", progress: 95, message: "Đang lấy kết quả..." });

        const generatedVideos = (operation as any).response?.generatedVideos || [];
        if (generatedVideos.length === 0) {
          sendSSE({ type: "error", message: "Không nhận được video nối từ API" });
          res.end();
          return;
        }

        const video = generatedVideos[0].video;
        const videoUri = video?.uri || null;
        const videoBytes = video?.videoBytes || null;

        // Nối video thành công → tăng videoCount
        await incrementVideoCount(context.id);

        sendSSE({
          type: "done",
          progress: 100,
          data: {
            videoUri,
            videoBytes,
            mimeType: video?.mimeType || "video/mp4",
          },
        });
        res.end();
      } catch (err: any) {
        logger.error(`[extend-video] Lỗi: ${err?.message}`);
        // If SSE headers already sent, send error event
        if (res.headersSent) {
          res.write(
            `data: ${JSON.stringify({ type: "error", message: err?.message || "Lỗi server" })}\n\n`
          );
          res.end();
        } else {
          const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
        }
      }
    },
  },
  {
    method: "post",
    path: "/api/app/generation-audio-tts/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          /** The text/dialogue to convert to speech */
          text: string;
          /** Voice name (e.g. "Kore", "Puck", "Aoede", etc.) */
          voiceName?: string;
          /** Optional style/tone instructions prepended to the text */
          stylePrompt?: string;
        };

        if (!body?.text) {
          return res.status(400).json({ message: "Thiếu text để tạo giọng nói" });
        }

        const genAI = await getCustomerGeminiClient(context.id);

        const voiceName = body.voiceName || "Kore";
        const textContent = body.stylePrompt ? `${body.stylePrompt}\n\n${body.text}` : body.text;

        logger.info(`[generation-tts] Gọi Gemini TTS (voice: ${voiceName}) cho user ${context.id}`);

        const response = await retryAICall(
          () =>
            genAI.models.generateContent({
              model: "gemini-2.5-flash-preview-tts",
              contents: [{ role: "user", parts: [{ text: textContent }] }],
              config: {
                responseModalities: ["AUDIO"],
                speechConfig: {
                  voiceConfig: {
                    prebuiltVoiceConfig: {
                      voiceName,
                    },
                  },
                },
              } as any,
            }),
          "generation-tts"
        );

        // Extract audio from response
        const parts = (response as any).candidates?.[0]?.content?.parts || [];
        const audioPart = parts.find((part: any) => part.inlineData);

        if (!audioPart?.inlineData?.data) {
          return res.status(500).json({ message: "Không nhận được audio từ API" });
        }

        const rawBase64 = audioPart.inlineData.data;
        const rawMimeType = audioPart.inlineData.mimeType || "audio/L16;rate=24000";

        // Parse sample rate from mimeType (e.g. "audio/L16;rate=24000")
        const rateMatch = rawMimeType.match(/rate=(\d+)/);
        const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
        const bitsPerSample = 16;
        const numChannels = 1;

        // Decode raw PCM base64 to Buffer
        const pcmBuffer = Buffer.from(rawBase64, "base64");
        const dataLength = pcmBuffer.length;

        // Build WAV header (44 bytes) for 16-bit mono PCM
        const wavHeader = Buffer.alloc(44);
        const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
        const blockAlign = numChannels * (bitsPerSample / 8);

        wavHeader.write("RIFF", 0);
        wavHeader.writeUInt32LE(36 + dataLength, 4); // ChunkSize
        wavHeader.write("WAVE", 8);
        wavHeader.write("fmt ", 12);
        wavHeader.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
        wavHeader.writeUInt16LE(1, 20); // AudioFormat (PCM = 1)
        wavHeader.writeUInt16LE(numChannels, 22);
        wavHeader.writeUInt32LE(sampleRate, 24);
        wavHeader.writeUInt32LE(byteRate, 28);
        wavHeader.writeUInt16LE(blockAlign, 32);
        wavHeader.writeUInt16LE(bitsPerSample, 34);
        wavHeader.write("data", 36);
        wavHeader.writeUInt32LE(dataLength, 40);

        // Combine header + PCM data → full WAV file
        const wavBuffer = Buffer.concat([new Uint8Array(wavHeader), new Uint8Array(pcmBuffer)]);
        const wavBase64 = wavBuffer.toString("base64");

        res.json({
          success: true,
          data: {
            audioBytes: wavBase64,
            mimeType: "audio/wav",
            sampleRate,
            durationMs: Math.round(
              (dataLength / (sampleRate * numChannels * (bitsPerSample / 8))) * 1000
            ),
          },
        });
      } catch (err: any) {
        logger.error(`[generation-tts] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
