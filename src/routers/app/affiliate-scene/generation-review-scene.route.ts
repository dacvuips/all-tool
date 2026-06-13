import { Request, Response } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import logger from "../../../helpers/logger";
import { Context } from "../../../libs/graphql";
import { ReviewResponseSchema } from "../constanst";
import { ReviewOpenAIJsonSchema, CHATGPT_MODELS } from "./_chatgpt.constants";
import { GEMINI_MODELS } from "./_gemini.constants";
import {
  assertNonEmptyScenesArray,
  buildImageReferenceNotes,
  callChatGPTGateway,
  callGeminiJsonGenerate,
  checkRequestLimit,
  collectOrderedReviewReferenceImages,
  getImageDisplayName,
  incrementRequestCount,
  interpolateTemplate,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
  resolveArtStylePrompt,
  resolveReferenceImagesForGemini,
  ReviewFormConfig,
} from "./_shared";

interface ReviewPromptScene {
  id: string;
  timestamp: string;
  scene_type: "CHARACTER" | "OBJECT";
  sceneNumber: number;
  visual_prompt: string;
  motion_description: string;
  audio_description: string;
  original_content: string;
  translated_content: string | null;
}

export default [
  {
    method: "post",
    path: "/api/app/generation-review-scene/",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const context = new Context({ req });
        context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);

        const body = req.body as {
          config: ReviewFormConfig;
        };
        body.config.artStyleImgNames = body.config.artStyleImg?.map((img) => {
          return getImageDisplayName(img);
        });

        if (!body?.config) {
          return res.status(400).json({ message: "Thiếu config" });
        }

        await checkRequestLimit(context.id);

        const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
          artStyleId: body.config.artStyleId,
          artStyle: body.config.artStyle,
        });

        if (resolvedArtStylePrompt) {
          body.config.artStyle = resolvedArtStylePrompt;
        }
        const artStyleImgNames = body.config.artStyleImgNames?.join(", ");

        const prompt = `You are a specialist in product photography and videography.
Your task is to generate exactly {{batchSize}} scenes for a short-form product review video based on the following configuration.  
Use the following contextual settings: {{objectToPersonify}},  {{language}}, {{prompt}}.
Return valid JSON only with this structure:
{
  "scenes": [
   {
  "topicTitle": "a short title for each s cene in {{language}}",
  "artStyle": "{{artStyle}}", 
  "visualPrompt":"English Use exactly ONE reference image name from ${
    artStyleImgNames || "none"
  } as the main product reference image for this scene. Assign reference images sequentially across all {{batchSize}} scenes in list order: Scene 1 uses the first image name, Scene 2 uses the second, and so on. When all image names have been used, restart from the first image and continue cycling in order until every scene has been assigned exactly one reference image. Select only ONE reference image by name per scene. - Analyze the uploaded product image and generate new actions for the product shown in the image based on the exact sequentially assigned name (for example: holding and rotating left or right, moving, opening and closing, etc.). - from a realistic POV (Point of View) perspective. - Maintain realistic lighting and accurate surface textures that match the actual product. - Based on the product’s characteristics, the product must interact naturally with relevant surrounding objects (for example: a mop should interact with the floor, etc.).",
  "environment": "Accurately and thoroughly describe the environment shown in the image.",
  "voiceGender": "male or female",
  "audioPrompt": "English voice casting: gender, accent, tone, emotion, pacing",
  "motionPrompt": "from a realistic POV (Point of View) perspective",   
  "audio": "voice metada  ta in {{language}}",
  "dialogue": " dialogue/narration in {{language}}"
  "camera": "English one exact value from CAMERA_TYPE ",
}
  ]
}

`;

        const referenceInputs = collectOrderedReviewReferenceImages(body.config);
        const imageBase64List = await resolveReferenceImagesForGemini(referenceInputs);
        const imageReferenceNote = buildImageReferenceNotes({
          productImages: body.config.artStyleImg,
          personifyImages: body.config.objectToPersonifyImage
            ? [body.config.objectToPersonifyImage]
            : undefined,
        });

        const interpolatedText = interpolateTemplate(prompt, body.config) + imageReferenceNote;

        const aiProvider = await resolveAiSceneProvider();
        let responseText: string;

        if (aiProvider === "gemini") {
          responseText = await callGeminiJsonGenerate({
            model: GEMINI_MODELS.REVIEW_SCENE,
            text: interpolatedText,
            media: imageBase64List.length > 0 ? imageBase64List : undefined,
            label: "generation-review",
            responseSchema: ReviewResponseSchema,
          });
        } else {
          responseText = await callChatGPTGateway({
            text: interpolatedText,
            images: imageBase64List,
            label: "generation-review",
            model: CHATGPT_MODELS.REVIEW_SCENE,
            jsonSchema: ReviewOpenAIJsonSchema,
            jsonSchemaName: "review_scene_response",
          });
        }
        const rawParsed = parseGeminiJsonResponse(responseText) as any;
        assertNonEmptyScenesArray(rawParsed.scenes);

        const parsed = {
          artStyle: rawParsed.artStyle || "",
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
                },
              ],
          scenes: rawParsed.scenes.map((scene: any) => ({
            visualPrompt: scene.visualPrompt || "",
            topicTitle: scene.topicTitle || "",
            sceneNumber: scene.sceneNumber,
            camera: scene.camera || "",
            motionPrompt: `[${scene.camera}]: ${scene.motionPrompt}, Visual atmosphere: ${
              scene.visualEffects || ""
            }`,
            imageGenPrompt: `[${scene.camera}] POV shot: ${scene.visualPrompt}. Setting: ${rawParsed.environment}.${rawParsed.artStyle}`,
            audio:
              `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${scene.audio}` || "",
            dialogue: scene.dialogue || "",
          })),
        };

        await incrementRequestCount(context.id);
        return res.json({ success: true, data: parsed });
      } catch (err: any) {
        logger.error(`[generation-review] Lỗi: ${err?.message}`);
        const status = err?.statusCode || 500;
        return res.status(status).json({ message: err?.message || "Lỗi server" });
      }
    },
  },
];
