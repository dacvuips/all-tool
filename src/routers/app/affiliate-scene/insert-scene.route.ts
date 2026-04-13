import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { getCustomerGeminiClient, retryAICall } from "./_shared";

export default [
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
];
