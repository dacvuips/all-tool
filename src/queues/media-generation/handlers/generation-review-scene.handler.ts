/**
 * Handler GENERATION_REVIEW_SCENE — Flow2 gen_text tạo kịch bản review product (JSON).
 */
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import {
  DEFAULT_FLOW2_TEXT_MODEL,
  generateTextWithFlow2,
  MAX_FLOW2_TEXT_IMAGES,
  type Flow2TextResult,
} from "../../../routers/api-media/flow2/text-generation";
import { ReviewOpenAIJsonSchema } from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import {
  assertNonEmptyScenesArray,
  buildImageReferenceNotes,
  collectOrderedReviewReferenceImages,
  filterReferenceImages,
  getImageDisplayName,
  incrementRequestCount,
  interpolateTemplate,
  normalizeSceneAudioField,
  parseGeminiJsonResponse,
  resolveArtStylePrompt,
  resolveReferenceImagesForGemini,
  ReviewFormConfig,
  unwrapAiJsonPayload,
  type ReferenceImageInput,
} from "../../../routers/app/affiliate-scene/_shared";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";

export type GenerationReviewScenePayload = {
  config: ReviewFormConfig;
};

function uniqueProductImageNames(names?: Array<string | undefined | null>): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of names || []) {
    const name = String(raw || "").trim();
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

function displayNameOfRef(item: ReferenceImageInput, fallbackIndex: number): string {
  if (typeof item === "string") return `image_${fallbackIndex + 1}`;
  const name = getImageDisplayName({
    name: item.name || "",
    imageBytes: item.imageBytes || "",
  });
  return name || `image_${fallbackIndex + 1}`;
}

/** Ảnh gửi Flow2 theo đúng thứ tự → input_file_0, input_file_1, ... */
function collectAttachedImagesWithNames(config: ReviewFormConfig) {
  const named: { name: string; input: ReferenceImageInput }[] = [];
  for (const item of collectOrderedReviewReferenceImages(config)) {
    if (filterReferenceImages([item]).length === 0) continue;
    named.push({ name: displayNameOfRef(item, named.length), input: item });
    if (named.length >= MAX_FLOW2_TEXT_IMAGES) break;
  }
  return named;
}

function buildAttachedImageIndexNote(attachedNames: string[]): string {
  if (!attachedNames.length) return "";
  const lines = attachedNames.map((name, i) => `- input_file_${i}.png = "${name}"`);
  return [
    "",
    "ATTACHED_IMAGE_INDEX (same order as uploaded files; Gemini labels them input_file_N):",
    ...lines,
    "When referring to an image, ALWAYS write the name on the right, never input_file_N.",
  ].join("\n");
}

function buildReviewSceneSystemInstruction(productNames: string[], attachedNames: string[]): string {
  const attachedRule = attachedNames.length
    ? `Attached files are labeled input_file_N internally. Map them as: ${attachedNames
        .map((name, i) => `input_file_${i}.png="${name}"`)
        .join("; ")}. Never output input_file_*.`
    : "";
  const nameRule = productNames.length
    ? `Each scene.visualPrompt MUST contain exactly one product image name from ${JSON.stringify(
        productNames
      )} as a literal token.`
    : "";
  return [
    "You are a specialist in product photography and videography.",
    "Return ONLY a raw JSON object matching this JSON Schema exactly.",
    "No markdown, no code fences, no explanation, no extra text.",
    attachedRule,
    nameRule,
    JSON.stringify(ReviewOpenAIJsonSchema),
  ]
    .filter(Boolean)
    .join("\n");
}

function parseFlow2ReviewJson(result: Flow2TextResult): Record<string, unknown> {
  if (Array.isArray(result.json)) {
    return { scenes: result.json };
  }
  if (result.json && typeof result.json === "object") {
    return unwrapAiJsonPayload(result.json);
  }
  return parseGeminiJsonResponse(result.text);
}

function assignedProductImageName(names: string[], sceneIndex: number): string {
  if (!names.length) return "";
  return names[sceneIndex % names.length];
}

function promptContainsImageName(text: string, name: string): boolean {
  if (!name) return false;
  return text.toLowerCase().includes(name.toLowerCase());
}

/** input_file_N → tên file đúng index ảnh đã gửi. */
function replaceInputFileAliasesByIndex(text: string, attachedNames: string[]): string {
  if (!text || !attachedNames.length) return text;
  let out = text;
  for (let i = attachedNames.length - 1; i >= 0; i--) {
    const name = attachedNames[i];
    if (!name) continue;
    out = out.replace(new RegExp(`input_file_${i}(?:\\.[A-Za-z0-9]+)?`, "gi"), name);
  }
  return out.replace(/\s{2,}/g, " ").trim();
}

function ensureProductNameInText(text: string, productName: string): string {
  if (!productName) return text;
  if (promptContainsImageName(text, productName)) return text;
  return text ? `${productName}, ${text}` : productName;
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

  body.config.artStyleImgNames = uniqueProductImageNames(
    body.config.artStyleImg?.map((img) => getImageDisplayName(img))
  );
  const productImageNames = body.config.artStyleImgNames;
  const productImageNamesList = productImageNames.length
    ? productImageNames.map((name) => `"${name}"`).join(", ")
    : "none";

  const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
    artStyleId: body.config.artStyleId,
    artStyle: body.config.artStyle,
  });
  if (resolvedArtStylePrompt) {
    body.config.artStyle = resolvedArtStylePrompt;
  }

  const prompt = `You are a specialist in product photography and videography.
Your task is to generate exactly {{batchSize}} scenes for a short-form product review video based on the following configuration.
Use the following contextual settings: {{objectToPersonify}}, {{language}}, {{prompt}}.

PRODUCT_IMAGE_NAMES (exact tokens, copy verbatim): ${productImageNamesList}
Assignment: Scene 1 uses the first name, Scene 2 uses the second, then cycle until every scene has exactly one name.
FORBIDDEN: input_file_0, input_file_1, input_file_N.png, or any input_file_* — those are internal upload labels, not product names.

visualPrompt rules:
- Start with the assigned PRODUCT_IMAGE_NAMES token (example: ${productImageNames[0] || "product-name"}).
- English. Analyze the uploaded product and invent a new action (hold/rotate/open/close/move).
- Realistic POV. Keep lighting, surface, and product appearance accurate.
- Product must interact naturally with surrounding objects.

Return valid JSON only with this structure:
{
  "scenes": [
   {
  "topicTitle": "a short title for each scene in {{language}}",
  "artStyle": "{{artStyle}}",
  "visualPrompt": "${productImageNames[0] || "product-name"}, POV shot: ...",
  "environment": "Accurately and thoroughly describe the environment shown in the image.",
  "voiceGender": "male or female",
  "audioPrompt": "English voice casting: gender, accent, tone, emotion, pacing",
  "motionPrompt": "from a realistic POV (Point of View) perspective",
  "audio": "voice metadata in {{language}}",
  "dialogue": "dialogue/narration in {{language}}",
  "camera": "English one exact value from CAMERA_TYPE"
}
  ]
}
CRITICAL OUTPUT: Return ONLY a raw JSON object. No markdown, no code fences, no explanation, no extra text.
`;

  await emitter.progress(20, "Đang gửi prompt lên Flow2 gen_text...");

  const attachedImages = collectAttachedImagesWithNames(body.config);
  const attachedNames = attachedImages.map((item) => item.name);
  const imageBase64List = await resolveReferenceImagesForGemini(
    attachedImages.map((item) => item.input)
  );
  const imageReferenceNote = buildImageReferenceNotes({
    productImages: body.config.artStyleImg,
    personifyImages: body.config.objectToPersonifyImage
      ? [body.config.objectToPersonifyImage]
      : undefined,
  });

  const interpolatedText =
    interpolateTemplate(prompt, body.config) +
    imageReferenceNote +
    buildAttachedImageIndexNote(attachedNames);

  const { result } = await generateTextWithFlow2({
    prompt: interpolatedText,
    systemInstruction: buildReviewSceneSystemInstruction(productImageNames, attachedNames),
    model: DEFAULT_FLOW2_TEXT_MODEL,
    thinkingLevel: "HIGH",
    imageInputs: imageBase64List,
    customerId: job.customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  await emitter.progress(85, "Đang chuẩn hoá kết quả...");

  const rawParsed = parseFlow2ReviewJson(result) as any;
  assertNonEmptyScenesArray(rawParsed.scenes, { label: "generation-review", parsed: rawParsed });

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
    scenes: rawParsed.scenes.map((scene: any, index: number) => {
      const productName = assignedProductImageName(productImageNames, index);
      const visualPrompt = ensureProductNameInText(
        replaceInputFileAliasesByIndex(scene.visualPrompt || "", attachedNames),
        productName
      );
      return {
        visualPrompt,
        topicTitle: scene.topicTitle || "",
        sceneNumber: scene.sceneNumber,
        camera: scene.camera || "",
        motionPrompt: `[${scene.camera}]: ${scene.motionPrompt}, Visual atmosphere: ${
          scene.visualEffects || ""
        }`,
        imageGenPrompt: `[${scene.camera}] POV shot: ${visualPrompt}. Setting: ${rawParsed.environment}.${rawParsed.artStyle}`,
        audio:
          `Voice: ${rawParsed.voiceGender}, ${rawParsed.voiceStyle}, ${normalizeSceneAudioField(scene.audio)}` ||
          "",
        dialogue: scene.dialogue || "",
      };
    }),
  };

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất kịch bản review");
  return { data: parsed };
}
