/**
 * Handler GENERATION_REVIEW_SCENE — AI tạo kịch bản review product (JSON) qua Flow2 gen_text.
 */
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import {
  generateTextWithFlow2,
  type Flow2TextResult,
} from "../../../routers/api-media/flow2/text-generation";
import { ReviewOpenAIJsonSchema } from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import {
  ReviewFormConfig,
  assertNonEmptyScenesArray,
  buildImageReferenceNotes,
  collectOrderedReviewReferenceImages,
  getImageDisplayName,
  incrementRequestCount,
  interpolateTemplate,
  normalizeSceneAudioField,
  parseGeminiJsonResponse,
  resolveArtStylePrompt,
  resolveReferenceImagesForGemini,
  unwrapAiJsonPayload,
} from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";

export type GenerationReviewScenePayload = {
  config: ReviewFormConfig;
};

function parseReviewJson(result: Flow2TextResult): Record<string, unknown> {
  if (Array.isArray(result.json)) return { scenes: result.json };
  if (result.json && typeof result.json === "object") return unwrapAiJsonPayload(result.json);
  return parseGeminiJsonResponse(result.text);
}

function normalizeImageTokenName(value: unknown): string {
  return String(value || "").trim();
}

function buildInputImageAliasMap(productNames: string[]): Record<number, string> {
  const map: Record<number, string> = {
    1: "ảnh tham chiếu nhân vật",
  };
  for (let i = 0; i < productNames.length; i++) {
    const index = i + 2;
    const name = normalizeImageTokenName(productNames[i]);
    map[index] = name || `sản phẩm ${i + 1}`;
  }
  return map;
}

/**
 * Convert Input_Image_N (1-based, nhân vật = 1) -> tên thực
 * Convert input_file_N (0-based, nhân vật = 0) -> tên thực
 * Convert image N (1-based, nhân vật = 1) -> tên thực
 */
function replaceInputImageAliases(text: string, aliasMap: Record<number, string>): string {
  if (!text) return text;

  const mapIndex = (index: number, full: string) => {
    const mapped = aliasMap[index];
    return mapped ? mapped : full;
  };

  // input_file_N.ext (0-based): input_file_0 = nhân vật, input_file_1 = sản phẩm 1, ...
  let out = text.replace(/input[_\s-]*file[_\s-]*(\d+)(?:\.[a-z0-9]+)?/gi, (full, n) => {
    const index = Number(n);
    if (!Number.isFinite(index)) return full;
    return mapIndex(index + 1, full);
  });

  // Input_Image_N.ext (1-based): Input_Image_1 = nhân vật, Input_Image_2 = sản phẩm 1, ...
  out = out.replace(/input[_\s-]*image[_\s-]*(\d+)(?:\.[a-z0-9]+)?/gi, (full, n) => {
    const index = Number(n);
    if (!Number.isFinite(index)) return full;
    return mapIndex(index, full);
  });

  // image N / imageN (1-based): image 1 = nhân vật, image 2 = sản phẩm 1, ...
  // Negative lookbehind tránh match lại phần "image N" trong "input image N" (đã xử lý ở trên)
  out = out.replace(/(?<!(?:input\s))image\s*(\d+)\b/gi, (full, n) => {
    const index = Number(n);
    if (!Number.isFinite(index)) return full;
    return mapIndex(index, full);
  });

  return out;
}

export async function handleGenerationReviewScene(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const body = await loadMediaJobPayload<GenerationReviewScenePayload>(job);
  if (!body?.config) {
    throw Object.assign(new Error("Thiếu config"), { statusCode: 400 });
  }

  await emitter.progress(8, "Đang chuẩn bị kịch bản review...");

  body.config.artStyleImgNames = body.config.artStyleImg?.map((img) => getImageDisplayName(img));

  const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
    artStyleId: body.config.artStyleId,
    artStyle: body.config.artStyle,
  });
  if (resolvedArtStylePrompt) {
    body.config.artStyle = resolvedArtStylePrompt;
  }

  const artStyleImgNames = body.config.artStyleImgNames?.join(", ");
  const inputImageAliasMap = buildInputImageAliasMap(body.config.artStyleImgNames || []);

  // Prompt gốc giữ nguyên hoàn toàn
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
  } as the main product reference image for this scene. Assign reference images sequentially across all {{batchSize}} scenes in list order: Scene 1 uses the first image name, Scene 2 uses the second, and so on. When all image names have been used, restart from the first image and continue cycling in order until every scene has been assigned exactly one reference image. Select only ONE reference image by name per scene. - Analyze the uploaded product image and generate new actions for the product shown in the image based on the exact sequentially assigned name (for example: holding and rotating left or right, moving, opening and closing, etc.). - from a realistic POV (Point of View) perspective. - Maintain realistic lighting and accurate surface textures that match the actual product. - Based on the product's characteristics, the product must interact naturally with relevant surrounding objects (for example: a mop should interact with the floor, etc.).",
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
CRITICAL OUTPUT: Return ONLY a raw JSON object. No markdown, no code fences, no explanation, no extra text.

IMPORTANT — REFERENCE IMAGES:
IMPORTANT: The first reference image is always the character; from the second reference image onward, the images are product images.
• Image 1 (character/personification): You MUST preserve the character's exact appearance, shape, color, material, and identifying features—including the face with the correct proportions of eyes, nose, and mouth—as well as the character's size, 100% identical to the first reference image when generating images. Do NOT transform the character into a personified/anthropomorphized version, and do not arbitrarily add or remove anything. For example, if the first image shows a young man, the second image must also be a young man (a different one is not allowed; it must not be a woman). Do not change the accessories or clothing the man is wearing, and do not change his hairstyle. For example, if the accessory in the first scene is a hat, the second image must also feature a hat, not a shirt. • Image 2 onward (products): You MUST place ALL products into ONE single unified image. Each product must preserve its exact appearance, shape, color, brand, and packaging as shown in the reference image. Arrange all products naturally within a single, cohesive composition. Every product must be clearly visible and easily recognizable in the final image. Some random product items must be shown being held in the character's hand.
`;

  await emitter.progress(20, "Đang gọi Flow2 gen_text tạo kịch bản review...");

  const referenceInputs = collectOrderedReviewReferenceImages(body.config);
  const imageBase64List = await resolveReferenceImagesForGemini(referenceInputs);
  const imageReferenceNote = buildImageReferenceNotes({
    productImages: body.config.artStyleImg,
    personifyImages: body.config.objectToPersonifyImage
      ? [body.config.objectToPersonifyImage]
      : undefined,
  });

  const interpolatedText = interpolateTemplate(prompt, body.config) + imageReferenceNote;

  const { result } = await generateTextWithFlow2({
    prompt: interpolatedText,
    systemInstruction: "You are a specialist in product photography and videography.",
    imageInputs: imageBase64List.length > 0 ? imageBase64List : undefined,
    jsonMode: true,
    jsonSchema: ReviewOpenAIJsonSchema,
    customerId: job.customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  await emitter.progress(85, "Đang chuẩn hoá kết quả...");

  const rawParsed = parseReviewJson(result) as any;
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
      visualPrompt: replaceInputImageAliases(scene.visualPrompt || "", inputImageAliasMap),
      topicTitle: scene.topicTitle || "",
      sceneNumber: scene.sceneNumber,
      camera: scene.camera || "",
      motionPrompt: `[${scene.camera}]: ${scene.motionPrompt}, Visual atmosphere: ${
        scene.visualEffects || ""
      }`,
      imageGenPrompt: `[${scene.camera}] POV shot: ${replaceInputImageAliases(
        scene.visualPrompt || "",
        inputImageAliasMap
      )}. Setting: ${rawParsed.environment}.${rawParsed.artStyle}`,
      audio:
        `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${normalizeSceneAudioField(scene.audio)}` ||
        "",
      dialogue: scene.dialogue || "",
    })),
  };

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất kịch bản review");
  return { data: parsed };
}
