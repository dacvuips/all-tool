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

Create a consistent multi-scene AI video prompt using:
{{objectToPersonify}}, {{category}}, {{artStyle}}, {{language}}. Your task is to generate exactly {{batchSize}} cinematic scenes for a short-form video based on the following configuration.
Create 2 fixed English anchors:

CHARACTER_ANCHOR: Describe the character’s core identity and personified concept, head/face structure, facial features and default expression, overall size, body type, build, silhouette, proportions, full anatomy, posture, surface texture if relevant, outfit, shoes, accessories, signature details, colors, materials, textures, patterns, finish, and distinctive memorable traits. Art style influence from {{artStyle}}

ENVIRONMENT_ANCHOR: Must be one short, vivid sentence describing: - the main location - 4–6 key visual objects/details - the overall atmosphere or outside view

- Return valid JSON only. Each scene
CAMERA_TYPE = [Close-up, Medium shot, Wide shot, Full shot, Low angle, High angle, Over-the-shoulder, Tracking shot, Dolly in, Dolly out, Pan left, Pan right, Tilt up, Tilt down, Orbit shot, Static shot, Handheld].

{
  "topicTitle": "in {{language}}",
  "artStyle": "{{artStyle}}",
  "camera": one exact value from CAMERA_TYPE,
  "cast": [{"name": "in {{language}}", "tag": "main", "description": "CHARACTER_ANCHOR"}],
  "characterName": "same as main name in {{language}}",
  "characterBaseDescription": "CHARACTER_ANCHOR",
  "environment": "ENVIRONMENT_ANCHOR",
  "voiceGender": "male or female",
  "audioPrompt": "English voice casting: gender, accent, tone, emotion, pacing",
  "visualPrompt": "English scene summary",
  "motionPrompt": "[camera]: camera movement, character action, scene progression",
  "imageGenPrompt": "Composite image generation prompt built as: CHARACTER_ANCHOR + ", " + [motionPrompt] + ". Setting: " + ENVIRONMENT_ANCHOR + ". " + [artStyle] (in English)",
  "audio": "voice metadata in {{language}}",
  "dialogue": "dialogue/narration in {{language}}"
}

CRITICAL RULE: Never generate any visible or readable text in the image. Do not include any letters, words, numbers, logos, captions, labels, subtitles, signs, watermarks, or interface text. English for prompts/descriptions/environment. {{language}} for title/name/audio/dialogue. Always keep character and environment identical.   
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
