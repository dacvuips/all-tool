/**
 * Handler COPY_VIDEO_ANALYSIS — AI phân tích video gốc → JSON scenes.
 */
import {
  buildVideoAnalysisPrompt,
  CopyVideoAnalysisResponseSchema,
} from "../../../routers/app/affiliate-scene/_copy-video-analysis";
import {
  assertNonEmptyScenesArray,
  buildObjectPersonifyImageScriptNote,
  buildProductImageScriptNote,
  callGeminiJsonGenerate,
  filterReferenceImages,
  getGeminiSceneModel,
  incrementRequestCount,
  parseGeminiJsonResponse,
  resolveArtStylePrompt,
  resolveObjectToPersonifyPrompt,
} from "../../../routers/app/affiliate-scene/_shared";
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

  await emitter.progress(20, "Đang gọi AI phân tích video...");

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

  const responseText = await callGeminiJsonGenerate({
    model: await getGeminiSceneModel("COPY_VIDEO"),
    text,
    media: [{ imageBytes: body.videoBase64, mimeType }],
    label: "copy-video-analysis",
    responseSchema: CopyVideoAnalysisResponseSchema,
    temperature: 0.4,
  });

  await emitter.progress(90, "Đang chuẩn hoá kết quả...");

  const parsed = parseGeminiJsonResponse(responseText);
  assertNonEmptyScenesArray(parsed.scenes);

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất phân tích video");
  return { data: parsed as Record<string, unknown> };
}
