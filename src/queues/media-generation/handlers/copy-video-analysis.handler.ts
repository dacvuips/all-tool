/**
 * Handler COPY_VIDEO_ANALYSIS — Flow2 gen_text phân tích video gốc → JSON scenes.
 */
import {
  buildVideoAnalysisPrompt,
} from "../../../routers/app/affiliate-scene/_copy-video-analysis";
import { CopyVideoAnalysisOpenAIJsonSchema } from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import {
  assertNonEmptyScenesArray,
  buildObjectPersonifyImageScriptNote,
  buildProductImageScriptNote,
  filterReferenceImages,
  incrementRequestCount,
  parseGeminiJsonResponse,
  resolveArtStylePrompt,
  resolveObjectToPersonifyPrompt,
  resolveProductImagesForAi,
  resolveReferenceImagesForGemini,
  unwrapAiJsonPayload,
} from "../../../routers/app/affiliate-scene/_shared";
import {
  generateTextWithFlow2,
  type Flow2TextResult,
} from "../../../routers/api-media/flow2/text-generation";
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";

export type CopyVideoAnalysisPayload = {
  videoBase64: string;
  mimeType?: string;
  artStyle?: string;
  language?: string;
  mood?: string;
  aspectRatio?: string;
  productImages?: string[];
  objectToPersonifyImages?: import("../../../routers/app/affiliate-scene/_shared").ReferenceImageInput[];
  objectToPersonifyCode?: string;
  objectToPersonify?: string;
  artStyleId?: string;
};

const COPY_VIDEO_SYSTEM_INSTRUCTION = "You are an expert Video Production and AI Animation Director.";

function parseCopyVideoJson(result: Flow2TextResult): Record<string, unknown> {
  if (Array.isArray(result.json)) return { scenes: result.json };
  if (result.json && typeof result.json === "object") return unwrapAiJsonPayload(result.json);
  return parseGeminiJsonResponse(result.text);
}

export async function handleCopyVideoAnalysis(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const body = await loadMediaJobPayload<CopyVideoAnalysisPayload>(job);
  if (!body?.videoBase64) {
    throw Object.assign(new Error("Thiếu dữ liệu video (videoBase64)"), { statusCode: 400 });
  }

  await emitter.progress(8, "Đang chuẩn bị phân tích video...");

  const mimeType = body.mimeType || "video/mp4";
  const personifyImageRefs = filterReferenceImages(body.objectToPersonifyImages || []);
  const usePersonifyImage = personifyImageRefs.length > 0;
  let objectToPersonifyPrompt: string | undefined;

  if (!usePersonifyImage) {
    const resolved = await resolveObjectToPersonifyPrompt({
      objectToPersonifyCode: body.objectToPersonifyCode,
      objectToPersonify: body.objectToPersonify,
    });
    if (resolved.error) {
      throw Object.assign(new Error(resolved.error.message), {
        statusCode: resolved.error.status,
      });
    }
    objectToPersonifyPrompt = resolved.prompt;
    if (objectToPersonifyPrompt) {
      body.objectToPersonify = objectToPersonifyPrompt;
    }
  }

  const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
    artStyleId: body.artStyleId,
    artStyle: body.artStyle,
  });
  if (resolvedArtStylePrompt) {
    body.artStyle = resolvedArtStylePrompt;
  }

  await emitter.progress(20, "Đang gửi video lên Flow2 gen_text...");

  const productImageNote = buildProductImageScriptNote(body.productImages || []);
  const personifyImageNote = usePersonifyImage
    ? buildObjectPersonifyImageScriptNote(body.objectToPersonifyImages || [])
    : "";
  const text =
    buildVideoAnalysisPrompt({
      artStyle: body.artStyle,
      language: body.language,
      mood: body.mood,
      aspectRatio: body.aspectRatio,
      objectToPersonifyPrompt: usePersonifyImage ? undefined : objectToPersonifyPrompt,
    }) +
    personifyImageNote +
    productImageNote;

  const personifyImages = usePersonifyImage
    ? await resolveReferenceImagesForGemini(body.objectToPersonifyImages)
    : [];
  const productImages = await resolveProductImagesForAi(body.productImages);

  // Video goes first, followed by optional reference images
  const imageInputs = [
    { imageBytes: body.videoBase64, mimeType },
    ...personifyImages,
    ...productImages,
  ];

  const { result } = await generateTextWithFlow2({
    prompt: text,
    systemInstruction: COPY_VIDEO_SYSTEM_INSTRUCTION,
    imageInputs,
    jsonMode: true,
    jsonSchema: CopyVideoAnalysisOpenAIJsonSchema,
    customerId: job.customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  await emitter.progress(90, "Đang chuẩn hoá kết quả...");

  const parsed = parseCopyVideoJson(result) as any;
  assertNonEmptyScenesArray(parsed.scenes);

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất phân tích video");
  return { data: parsed as Record<string, unknown> };
}
