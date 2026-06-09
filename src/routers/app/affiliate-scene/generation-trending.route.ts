import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { TrendingModel } from "../../../libs/dal/trending/trending.model";
import { Context } from "../../../libs/graphql";
import { AffiliateVideoResponseSchema } from "../constanst";
import {
  assertGeminiTextResponse,
  assertNonEmptyScenesArray,
  callWithKeyRotation,
  checkRequestLimit,
  getAvailableGeminiClients,
  incrementRequestCount,
  interpolateTrendingTemplate,
  parseGeminiJsonResponse,
  resolveArtStylePrompt,
  TrendingModeTypeEnum,
  TrendingVideoFormConfig,
} from "./_shared";

export default [
  {
    method: "post",
    path: "/api/app/generation-trending/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: TrendingVideoFormConfig;
          productImages?: string[];
        };

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        // Kiểm tra giới hạn request trước khi tạo
        await checkRequestLimit(context.id);

        // ── Resolve artStyle prompt from DB ──
        const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
          artStyleId: body.config.artStyleId,
          artStyle: body.config.artStyle,
        });
        if (resolvedArtStylePrompt) {
          body.config.artStyle = resolvedArtStylePrompt;
        }

        // Build product image reference text
        const productImageUrls = body.productImages?.filter(Boolean) || [];
        const productImageNote =
          productImageUrls.length > 0
            ? `\n\n*** ẢNH SẢN PHẨM THAM CHIẾU ***\nCác ảnh sản phẩm dưới đây là tham chiếu cho sản phẩm chính trong video. Hãy sử dụng chúng để mô tả chính xác hơn các props / sản phẩm trong visual_prompt.\nURLs: ${productImageUrls.join(
                ", "
              )}`
            : "";

        const clients = await getAvailableGeminiClients();
        const trendingModeTypes = req?.body?.config?.trendingModeType;
        const IsTrendingSingle = trendingModeTypes === TrendingModeTypeEnum.single_variant;
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
        const interpolatedText =
          interpolateTrendingTemplate(prompt, body.config) + productImageNote;
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

        const responseText = assertGeminiTextResponse(response);
        const rawParsed = parseGeminiJsonResponse(responseText) as any;
        assertNonEmptyScenesArray(rawParsed.scenes);

        const parsed = {
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
            motionPrompt: `${rawParsed.characterBaseDescription} [${scene.camera}]: ${
              scene.motionPrompt
            }, Visual atmosphere: ${scene.visualEffects || ""}`,
            imageGenPrompt: IsTrendingSingle
              ? body.config.tipContent
              : `${rawParsed.characterBaseDescription},[${scene.camera}]: ${scene.motionPrompt}. Setting: ${rawParsed.environment}. Visual atmosphere: ${scene.visualEffects}.${rawParsed.artStyle}` ||
                "",
            audio:
              `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${scene.audio}` || "",
            dialogue: scene.dialogue || "",
          })),
        };

        if (body.config.promptId) {
          await TrendingModel.findByIdAndUpdate(body.config.promptId, {
            $inc: { count: 1, monthlyCount: 1 },
          });
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
