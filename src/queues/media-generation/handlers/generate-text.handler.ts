/**
 * Handler GENERATE_TEXT — Flow2 gen_text generic (JSON hoặc text).
 */
import {
  IMediaGenerationJob,
  MediaGenerationJsonResult,
} from "../../../libs/dal/mediaGenerationJob";
import { incrementRequestCount } from "../../../routers/app/affiliate-scene/_shared";
import {
  parseGenerateTextParams,
  type GenerateTextBody,
} from "../../../routers/app/generate-text/generate-text.params";
import {
  generateTextWithFlow2,
  serializeFlow2TextClientResult,
} from "../../../routers/api-media/flow2/text-generation";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";

export async function handleGenerateText(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const body = await loadMediaJobPayload<GenerateTextBody>(job);
  const params = parseGenerateTextParams(body || {});

  await emitter.progress(10, "Đang generate text...");

  const { result } = await generateTextWithFlow2({
    ...params,
    customerId: job.customerId,
    onProgress: async (progress, message) => {
      await emitter.progress(progress, message);
    },
    onRequestCreated: async (flow2RequestId) => {
      await emitter.setFlow2RequestId(flow2RequestId);
    },
  });

  const serialized = serializeFlow2TextClientResult(result);
  if (!serialized) {
    throw Object.assign(new Error("AI không trả kết quả generate text"), { statusCode: 502 });
  }

  await incrementRequestCount(job.customerId);
  await emitter.progress(100, "Hoàn tất generate text");
  return { data: serialized as Record<string, unknown> };
}
