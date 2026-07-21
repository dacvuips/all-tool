/**
 * Handler GENERATION_TRENDING — AI tạo kịch bản trending (JSON).
 */
import { AffiliateVideoOpenAIJsonSchema } from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import { AffiliateVideoResponseSchema } from "../../../routers/app/constanst";
import {
  assertNonEmptyScenesArray,
  buildProductImageScriptNote,
  callChatGPTGateway,
  callGeminiJsonGenerate,
  getChatGPTSceneModel,
  getGeminiSceneModel,
  incrementRequestCount,
  interpolateTrendingTemplate,
  normalizeSceneAudioField,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
  resolveArtStylePrompt,
  resolveProductImagesForAi,
  TrendingModeTypeEnum,
  TrendingVideoFormConfig,
} from "../../../routers/app/affiliate-scene/_shared";
import { TrendingModel } from "../../../libs/dal/trending/trending.model";
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";

export type GenerationTrendingPayload = {
  config: TrendingVideoFormConfig;
  productImages?: string[];
};

export async function handleGenerationTrending(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const body = await loadMediaJobPayload<GenerationTrendingPayload>(job);
  if (!body?.config) {
    throw Object.assign(new Error("Thiếu config"), { statusCode: 400 });
  }

  await emitter.progress(8, "Đang chuẩn bị kịch bản trending...");

  const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
    artStyleId: body.config.artStyleId,
    artStyle: body.config.artStyle,
  });
  if (resolvedArtStylePrompt) {
    body.config.artStyle = resolvedArtStylePrompt;
  }

  const productImageUrls = body.productImages?.filter(Boolean) || [];
  const productImageNote = buildProductImageScriptNote(productImageUrls);

  const trendingModeTypes = body.config?.trendingModeType;
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

- Return valid JSON only.
CAMERA_TYPE = [Close-up, Medium shot, Wide shot, Full shot, Low angle, High angle, Over-the-shoulder, Tracking shot, Dolly in, Dolly out, Pan left, Pan right, Tilt up, Tilt down, Orbit shot, Static shot, Handheld].
Root JSON structure:
{
  "topicTitle": "in {{language}}",
  "artStyle": "{{artStyle}}",
  "characterName": "same as main name in {{language}}",
  "characterBaseDescription": "CHARACTER_ANCHOR",
  "environment": "ENVIRONMENT_ANCHOR",
  "voiceGender": "male or female",
  "voiceTone": "",
  "voiceStyle": "",
  "audioPrompt": "English voice casting: gender, accent, tone, emotion, pacing",
  "scenes": [
    {
      "sceneNumber": 1,
      "camera": "one exact value from CAMERA_TYPE",
      "motionPrompt": "camera movement, character action, scene progression",
      "audio": "voice metadata in {{language}}",
      "dialogue": "dialogue/narration in {{language}}",
      "visualEffects": "one polished English sentence"
    }
  ]
}
CRITICAL RULE: Always keep character and environment identical across all scenes.
CRITICAL OUTPUT: Return ONLY a raw JSON object. No markdown, no code fences, no explanation, no extra text.
`;

  await emitter.progress(25, "Đang gọi AI tạo kịch bản trending...");

  const interpolatedText =
    interpolateTrendingTemplate(prompt, body.config) + productImageNote;

  const productImageBase64List = await resolveProductImagesForAi(productImageUrls);
  const aiProvider = await resolveAiSceneProvider();
  let responseText: string;

  if (aiProvider === "gemini") {
    responseText = await callGeminiJsonGenerate({
      model: await getGeminiSceneModel("TRENDING"),
      text: interpolatedText,
      media: productImageBase64List,
      label: "generation-trending",
      responseSchema: AffiliateVideoResponseSchema,
    });
  } else {
    responseText = await callChatGPTGateway({
      text: interpolatedText,
      images: productImageBase64List.map((img, index) => ({
        ...img,
        fileName: `photo-${index + 1}.${(img.mimeType || "").includes("png") ? "png" : "jpg"}`,
      })),
      label: "generation-trending",
      model: await getChatGPTSceneModel("TRENDING"),
      jsonSchema: AffiliateVideoOpenAIJsonSchema,
    });
  }

  await emitter.progress(85, "Đang chuẩn hoá kết quả...");

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
        `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${normalizeSceneAudioField(scene.audio)}` ||
        "",
      dialogue: scene.dialogue || "",
    })),
  };

  if (body.config.promptId) {
    await TrendingModel.findByIdAndUpdate(body.config.promptId, {
      $inc: { count: 1, monthlyCount: 1 },
    });
  }
  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất kịch bản trending");
  return { data: parsed };
}
