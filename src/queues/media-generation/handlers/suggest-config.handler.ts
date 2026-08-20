/**
 * Handler SUGGEST_CONFIG — Flow2 gen_text gợi ý objectToPersonify + tipContent.
 */
import { SuggestConfigOpenAIJsonSchema } from "../../../routers/app/affiliate-scene/_chatgpt.constants";
import {
  incrementRequestCount,
  parseGeminiJsonResponse,
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

export type SuggestConfigPayload = {
  category?: string;
  mood?: string;
  language?: string;
};

const SUGGEST_CONFIG_SYSTEM_INSTRUCTION = "You are a creative short-form video content specialist for TikTok/Reels.";

function parseSuggestJson(result: Flow2TextResult): Record<string, unknown> {
  if (result.json && !Array.isArray(result.json) && typeof result.json === "object") {
    return unwrapAiJsonPayload(result.json);
  }
  return parseGeminiJsonResponse(result.text);
}

export async function handleSuggestConfig(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const body = await loadMediaJobPayload<SuggestConfigPayload>(job);

  await emitter.progress(10, "Đang gợi ý cấu hình...");

  const categoryHint = body.category ? `Danh mục: ${body.category}` : "Danh mục: tự chọn";
  const moodHint = body.mood ? `Mood/Tính cách: ${body.mood}` : "";
  const languageHint = body.language || "vi";
  const outputLanguage =
    languageHint === "en"
      ? "English"
      : languageHint === "vn" || languageHint === "vi"
        ? "tiếng Việt"
        : languageHint;

  const prompt = `Bạn là một chuyên gia sáng tạo nội dung video ngắn trên TikTok/Reels.
Hãy gợi ý một ý tưởng video "mẹo vặt" hấp dẫn, sáng tạo, dễ viral.

${categoryHint}
${moodHint}
Ngôn ngữ: ${languageHint}

Yêu cầu:
1. "objectToPersonify": Một đồ vật / thực phẩm cụ thể để nhân hoá thành nhân vật chính (VD: "Một quả chuối tươi", "Một cuộn giấy vệ sinh", "Một chiếc tất lẻ"). Phải cụ thể, sinh động, dễ hình dung.
2. "tipContent": Nội dung mẹo vặt liên quan đến đồ vật đó (VD: "Cách bảo quản chuối tươi lâu gấp 3 lần", "5 công dụng bất ngờ của lõi giấy vệ sinh"). Phải hấp dẫn, gây tò mò.

CRITICAL: Return ONLY a raw JSON object with exactly these keys: objectToPersonify, tipContent.
No markdown, no code fences, no explanation, no extra text.
Write field values in ${outputLanguage}.`;

  await emitter.progress(30, "Đang gọi Flow2 gen_text...");

  const { result } = await generateTextWithFlow2({
    prompt,
    systemInstruction: SUGGEST_CONFIG_SYSTEM_INSTRUCTION,
    jsonMode: true,
    jsonSchema: SuggestConfigOpenAIJsonSchema,
    customerId: job.customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  const parsed = parseSuggestJson(result) as {
    objectToPersonify?: string;
    tipContent?: string;
  };

  const objectToPersonify = String(parsed.objectToPersonify || "").trim();
  const tipContent = String(parsed.tipContent || "").trim();
  if (!objectToPersonify || !tipContent) {
    throw Object.assign(new Error("AI trả JSON thiếu objectToPersonify hoặc tipContent"), {
      statusCode: 502,
    });
  }

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất gợi ý");
  return { data: { objectToPersonify, tipContent } };
}
