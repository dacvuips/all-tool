/**
 * Handler STORYBOARD_ANALYSIS — AI phân tích ảnh storyboard → JSON scenes.
 * Quota: route đã reserve slot (hoặc batch skipRequestReservation); fail → release.
 */
import { retryAICall } from "../../../routers/app/affiliate-scene/_ai-retry";
import {
  CHATGPT_STORYBOARD_MAX_OUTPUT_TOKENS,
  StoryboardAnalysisOpenAIJsonSchema,
} from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import { GEMINI_STORYBOARD_MAX_OUTPUT_TOKENS } from "../../../routers/app/affiliate-scene/_gemini.constants";
import { StoryboardAnalysisResponseSchema } from "../../../routers/app/affiliate-scene/storyboard-analysis.schema";
import {
  assertNonEmptyScenesArray,
  buildProductImageScriptNote,
  callChatGPTGateway,
  callGeminiJsonGenerate,
  getChatGPTSceneModel,
  getGeminiSceneModel,
  normalizeSceneAudioField,
  parseGeminiJsonResponse,
  resolveAiSceneProvider,
  resolveArtStylePrompt,
  resolveProductImagesForAi,
} from "../../../routers/app/affiliate-scene/_shared";
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import { loadMediaJobPayload } from "../media-job-data";
import { MediaJobEmitter } from "../job-emitter";
import { releaseStoryboardAnalysisQuotaIfNeeded } from "../storyboard-analysis-quota";

export type StoryboardAnalysisPayload = {
  storyboardImageBase64: string;
  mimeType?: string;
  artStyle?: string;
  artStyleId?: string;
  language?: string;
  aspectRatio?: string;
  tipContent?: string;
  productImages?: string[];
  /** true khi batch đã reserve N slot — mỗi ảnh không reserve thêm ở route */
  skipRequestReservation?: boolean;
  /** Route đã reserve 1 slot cho request đơn */
  reservedSingleSlot?: boolean;
};

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function buildStoryboardAnalysisPrompt(opts: {
  artStyle?: string;
  language?: string;
  aspectRatio?: string;
  tipContent?: string;
}): string {
  const artStyle = opts.artStyle?.trim();
  const language = opts.language || "Vietnamese";
  const aspectRatio = opts.aspectRatio || "9:16";
  const tipContent = opts.tipContent?.trim()
    ? `\nNội dung / thông điệp chính cần ưu tiên: ${opts.tipContent}`
    : "";
  const artStyleLine = artStyle
    ? `- Phong cách nghệ thuật: ${artStyle}`
    : "- Phong cách nghệ thuật: (không chỉ định)";

  return `
Bạn là chuyên gia Storyboard Analysis và AI Video Director.

Nhiệm vụ: Phân tích ẢNH STORYBOARD đính kèm (một hoặc nhiều panel/khung hình trong cùng một ảnh) và trả về kịch bản chi tiết cho từng phân cảnh.

QUY TẮC PHÁT HIỆN PHÂN CẢNH:
1. Xác định TẤT CẢ các panel/khung storyboard trong ảnh (có thể xếp dọc, ngang, hoặc lưới).
2. Sắp xếp theo thứ tự đọc tự nhiên: trên → dưới, trái → phải.
3. Số phân cảnh = số panel thực tế trong ảnh (KHÔNG tự ý thêm hoặc bớt).
4. Mỗi panel phải có cropRegion chính xác (bounding box) bao trọn panel đó.

QUY TẮC cropRegion (QUAN TRỌNG – dùng để cắt ảnh bằng JavaScript Canvas):
- Tất cả giá trị x, y, width, height là TỶ LỆ CHUẨN HOÁ từ 0 đến 1 so với kích thước ảnh gốc.
- x, y = góc trên-trái của panel.
- width, height = chiều rộng / chiều cao của panel.
- Không chồng lấn giữa các panel. Không cắt mất nội dung panel.

THÔNG TIN BỔ SUNG:
${artStyleLine}
- Tỉ lệ khung hình mục tiêu: ${aspectRatio}
- Ngôn ngữ lời thoại: ${language}${tipContent}

CHO MỖI PHÂN CẢNH (trong mảng scenes – BẮT BUỘC, ưu tiên hoàn thành trước), trả về:
- sceneNumber: số thứ tự (1, 2, 3, ...)
- cropRegion: vùng cắt chuẩn hoá
- camera: góc máy gợi ý
- dialogue: lời thoại/narration bằng ${language} – suy ra từ nội dung panel hoặc sáng tạo phù hợp
- motionPrompt: mô tả chuyển động bằng tiếng Anh (ngắn gọn)
- audio: metadata giọng đọc cho phân cảnh bằng ${language} (ngắn gọn)
- visualDescription: mô tả khung hình tĩnh bằng tiếng Anh${
    artStyle ? `, phong cách ${artStyle}` : ""
  } (ngắn gọn)

SAU KHI hoàn thành toàn bộ scenes, mới trả metadata giọng đọc toàn video (ngắn gọn):
- topicTitle: tiêu đề video bằng ${language} (tối đa ~60 ký tự)
- voiceGender: male hoặc female
- voiceTone, voiceStyle, voicePacing: mỗi field tối đa ~40 ký tự
- audioPrompt: tùy chọn, tiếng Anh tối đa ~60 ký tự (có thể bỏ trống)

QUAN TRỌNG: Mảng scenes phải đầy đủ và hợp lệ. Nếu thiếu token, rút ngắn dialogue/mô tả nhưng KHÔNG được bỏ scene.

CRITICAL OUTPUT: Return ONLY a raw JSON object matching the schema. No markdown, no code fences, no explanation, no extra text.
`;
}

async function callStoryboardAnalysisAi(params: {
  aiProvider: string;
  text: string;
  storyboardImageBase64: string;
  mimeType: string;
  productImages?: { imageBytes: string; mimeType: string }[];
}): Promise<string> {
  const { aiProvider, text, storyboardImageBase64, mimeType, productImages = [] } = params;
  const media = [{ imageBytes: storyboardImageBase64, mimeType }, ...productImages];

  if (aiProvider === "gemini") {
    return callGeminiJsonGenerate({
      model: await getGeminiSceneModel("STORYBOARD"),
      text,
      media,
      label: "storyboard-analysis",
      responseSchema: StoryboardAnalysisResponseSchema,
      temperature: 0.3,
      maxOutputTokens: GEMINI_STORYBOARD_MAX_OUTPUT_TOKENS,
    });
  }

  return callChatGPTGateway({
    text,
    images: media.map((img, index) => ({
      ...img,
      fileName:
        index === 0
          ? mimeType.includes("png")
            ? "storyboard.png"
            : "storyboard.jpg"
          : `photo-${index}.${(img.mimeType || "").includes("png") ? "png" : "jpg"}`,
    })),
    label: "storyboard-analysis",
    model: await getChatGPTSceneModel("STORYBOARD"),
    jsonSchema: StoryboardAnalysisOpenAIJsonSchema,
    jsonSchemaName: "storyboard_analysis_response",
    temperature: 0.3,
    maxTokens: CHATGPT_STORYBOARD_MAX_OUTPUT_TOKENS,
  });
}

}

export async function handleStoryboardAnalysis(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  try {
    const body = await loadMediaJobPayload<StoryboardAnalysisPayload>(job);
    if (!body?.storyboardImageBase64) {
      throw Object.assign(new Error("Thiếu ảnh storyboard (storyboardImageBase64)"), {
        statusCode: 400,
      });
    }

    await emitter.progress(8, "Đang chuẩn bị phân tích storyboard...");

    const { prompt: resolvedArtStylePrompt } = await resolveArtStylePrompt({
      artStyleId: body.artStyleId,
      artStyle: body.artStyle,
    });

    const artStyle = resolvedArtStylePrompt || body.artStyle;
    const productImageNote = buildProductImageScriptNote(body.productImages || []);
    const productImages = await resolveProductImagesForAi(body.productImages);

    const text =
      buildStoryboardAnalysisPrompt({
        artStyle,
        language: body.language,
        aspectRatio: body.aspectRatio,
        tipContent: body.tipContent,
      }) + productImageNote;

    const mimeType = body.mimeType || "image/png";
    const aiProvider = await resolveAiSceneProvider();

    await emitter.progress(25, "Đang gọi AI phân tích storyboard...");

    const parsed = (await retryAICall(async () => {
      const responseText = await callStoryboardAnalysisAi({
        aiProvider,
        text,
        storyboardImageBase64: body.storyboardImageBase64,
        mimeType,
        productImages,
      });
      return parseGeminiJsonResponse(responseText);
    }, "storyboard-analysis")) as any;
    assertNonEmptyScenesArray(parsed.scenes);

    await emitter.progress(90, "Đang chuẩn hoá phân cảnh...");

    const normalizedScenes = parsed.scenes.map((scene: any, index: number) => ({
      sceneNumber: scene.sceneNumber ?? index + 1,
      cropRegion: {
        x: clamp01(scene.cropRegion?.x ?? 0),
        y: clamp01(scene.cropRegion?.y ?? 0),
        width: clamp01(scene.cropRegion?.width ?? 1),
        height: clamp01(scene.cropRegion?.height ?? 1),
      },
      camera: scene.camera || "WIDE SHOT",
      dialogue: scene.dialogue || "",
      motionPrompt: scene.motionPrompt || "",
      audio: normalizeSceneAudioField(scene.audio),
      visualDescription: scene.visualDescription || "",
    }));

    await emitter.progress(100, "Hoàn tất phân tích storyboard");
    return {
      data: {
        topicTitle: parsed.topicTitle || "",
        voiceGender: parsed.voiceGender || "female",
        voiceTone: parsed.voiceTone || "",
        voiceStyle: parsed.voiceStyle || "",
        voicePacing: parsed.voicePacing || "moderate",
        audioPrompt: parsed.audioPrompt || "",
        scenes: normalizedScenes,
      },
    };
  } catch (err: any) {
    await releaseStoryboardAnalysisQuotaIfNeeded(job);
    throw err;
  }
}
