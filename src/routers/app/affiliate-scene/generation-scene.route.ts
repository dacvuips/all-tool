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

Before generating scenes, create two fixed anchors:

1. CHARACTER ANCHOR:
Create one fixed, highly detailed character description based on {{objectToPersonify}}.
This description must remain exactly the same in every scene.
It must include:
- face shape and facial features
- eyes, mouth, expression style
- body proportions
- arms, legs, hands, feet
- outfit, accessories, colors
- material/texture
- art style: {{artStyle}}
- consistent character identity

Save it as:
{{character_fixed_description}}

Important rule:
Do not redesign, reinterpret, recolor, resize, age, simplify, or change the character in any scene.

2. ENVIRONMENT ANCHOR:
Create one fixed background/environment description based on {{category}}.
This environment must remain exactly the same in every scene.
It must include:
- location
- main background objects
- lighting
- color palette
- atmosphere
- camera perspective
- time of day
- props and spatial layout

Save it as:
{{environment_fixed_description}}

Important rule:
Do not change the location, lighting style, background objects, color palette, or camera perspective unless the scene explicitly requires only a small camera movement.

For every scene:
- visualPrompt, imagePrompt, and motionPrompt must start with the exact same {{character_fixed_description}}.
- Then immediately include the exact same {{environment_fixed_description}}.
- The imagePrompt and videoPrompt must describe the same character, same action, same pose, same background, and same scene moment.
- Only the character’s pose, facial expression, and action may change between scenes.
- The character design, outfit, colors, body shape, and background must stay consistent.
- Use high-definition, consistent character design, cinematic composition.
- Aspect ratio: {{aspectRatio}}.
- Story mode: {{storyModeType}}.
- No text, no logo, no watermark, no subtitles, no written words in image or video.
- All visualPrompt, motionPrompt, and imagePrompt must be written in advanced English.
- All dialogue and content instructions must be in {{language}}.
- Audio: {{gender}} voice, {{mood}} tone, consistent across all scenes.
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
