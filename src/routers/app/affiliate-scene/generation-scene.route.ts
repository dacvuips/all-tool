import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { AffiliateVideoResponseSchema, StoryModeTypeEnum } from "../constanst";
import {
  AffiliateVideoFormConfig,
  callWithKeyRotation,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
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

        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);

        const clients = await getAvailableGeminiClients();
        const storyModeTypes = req?.body?.config?.storyModeType;

        const hasBatchSize = body.config.batchSize != null && body.config.batchSize > 0;
        const batchSizeInstruction = hasBatchSize
          ? `Your task is to generate exactly {{batchSize}} cinematic scenes`
          : `Your task is to generate an appropriate number of cinematic scenes (decide based on the script content, typically 4-8 scenes)`;

        const prompt = `

Create a consistent multi-scene AI video prompt using:
{{objectToPersonify}}, {{category}}, {{artStyle}}, {{language}}. ${batchSizeInstruction} for a short-form video based on the following configuration. Treat {{tipContent}} as the core message of the video
Create 2 fixed English anchors:

CHARACTER_ANCHOR: Describe the character’s core identity and personified concept, head/face structure, facial features and default expression, overall size, body type, build, silhouette, proportions, full anatomy, posture, surface texture if relevant, outfit, shoes, accessories, signature details, colors, materials, textures, patterns, finish, and distinctive memorable traits. Art style influence from {{artStyle}}. Save to characterBaseDescription

ENVIRONMENT_ANCHOR: Must be one short, vivid sentence describing: - the main location - 4–6 key visual objects/details - the overall atmosphere or outside view. Save to environment
Generate "visualEffects" as one polished English sentence.
It must make the scene feel visually rich, magical, and cinematic in a Pixar-like way.
Include: one lighting effect - one atmospheric detail - one character-related accent - one motion or action accent
Keep it concise, vivid, and scene-specific.

- Return valid JSON only. Each scene
CAMERA_TYPE = [Close-up, Medium shot, Wide shot, Full shot, Low angle, High angle, Over-the-shoulder, Tracking shot, Dolly in, Dolly out, Pan left, Pan right, Tilt up, Tilt down, Orbit shot, Static shot, Handheld].
{
  "topicTitle": "in {{language}}",
  "artStyle": "{{artStyle}}",
  "camera": one exact value from CAMERA_TYPE,
  "characterName": "same as main name in {{language}}",
  "characterBaseDescription": "CHARACTER_ANCHOR",
  "environment": "ENVIRONMENT_ANCHOR",
  "voiceGender": "male or female",
  "audioPrompt": "English voice casting: gender, accent, tone, emotion, pacing",
  "motionPrompt": "camera movement, character action, scene progression",   
  "audio": "voice metada  ta in {{language}}",
  "dialogue": " dialogue/narration in {{language}}"
}
CRITICAL RULE: Always keep character and environment identical.   
`;

        // Thay thế placeholder trong text
        const interpolatedText = interpolateTemplate(body.text || prompt, body.config);

        const response = await callWithKeyRotation(
          clients,
          (ai) =>
            ai.models.generateContent({
              model: "gemini-3-flash-preview",
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
          const rawParsed = JSON.parse(response.text || "{}");

          // Map to the desired structure
          if (rawParsed.scenes && Array.isArray(rawParsed.scenes)) {
            parsed = {
              topicTitle: rawParsed.topicTitle || "",
              artStyle: rawParsed.artStyle || "",
              characterName: rawParsed.characterName || "",
              characterBaseDescription: rawParsed.characterBaseDescription || "",
              environment: rawParsed.environment || "",
              voiceGender: rawParsed.voiceGender || "",
              voiceTone: rawParsed.voiceTone || "",
              voiceStyle: rawParsed.voiceStyle || "",
              audioPrompt: rawParsed.audioPrompt || "",
              cast: rawParsed.cast?.length
                ? rawParsed.cast
                : [
                    {
                      name: rawParsed.characterName || "",
                      tag: "main",
                      description: rawParsed.characterBaseDescription || "",
                    },
                  ],
              scenes: rawParsed.scenes.map((scene: any) => ({
                sceneNumber: scene.sceneNumber,
                camera: scene.camera || "",
                motionPrompt: `${
                  storyModeTypes === StoryModeTypeEnum.prompt_to_video
                    ? `${rawParsed.characterBaseDescription}, `
                    : ""
                } [${scene.camera}]: ${scene.motionPrompt}, Visual atmosphere: ${
                  scene.visualEffects || ""
                }`,
                imageGenPrompt:
                  storyModeTypes === StoryModeTypeEnum.image_to_video
                    ? `${rawParsed.characterBaseDescription},[${scene.camera}]: ${scene.motionPrompt}. Setting: ${rawParsed.environment}. Visual atmosphere: ${scene.visualEffects}.${rawParsed.artStyle}` ||
                      ""
                    : "",
                audio:
                  `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${scene.audio}` || "",
                dialogue: scene.dialogue || "",
              })),
            };
          } else {
            parsed = rawParsed;
          }
        } catch {
          parsed = { raw: response.text };
        }

        await incrementRequestCount(context.id);
        res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-scene] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
