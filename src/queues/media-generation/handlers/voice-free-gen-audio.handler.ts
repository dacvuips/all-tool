import { IMediaGenerationJob, MediaGenerationJsonResult } from "../../../libs/dal/mediaGenerationJob";
import { waitForFlow2Result } from "../../../routers/api-media/flow2/_shared";
import {
  collectFreeGenAudioUrls,
  createFreeGenAudioRequest,
} from "../../../routers/app/voice/_free-gen-audio";
import { MediaJobEmitter } from "../job-emitter";
import { loadMediaJobPayload } from "../media-job-data";

export type VoiceFreeGenAudioPayload = {
  text: string;
  voice: string;
};

export async function handleVoiceFreeGenAudio(
  job: IMediaGenerationJob,
  emitter: MediaJobEmitter
): Promise<MediaGenerationJsonResult> {
  const payload = await loadMediaJobPayload<VoiceFreeGenAudioPayload>(job);
  const text = String(payload.text || "").trim();
  const voice = String(payload.voice || "").trim().toLowerCase();

  if (!text) {
    throw Object.assign(new Error("Thiếu text gen_audio"), { statusCode: 400 });
  }
  if (!voice) {
    throw Object.assign(new Error("Thiếu voice gen_audio"), { statusCode: 400 });
  }

  await emitter.progress(15, "Đang gửi request tạo audio lên Flow2...");

  const created = await createFreeGenAudioRequest(text, voice, job.customerId);
  await emitter.setFlow2RequestId(created.requestId);
  await emitter.progress(55, `Đã tạo request Flow2 (${created.requestId}), đang chờ kết quả...`);

  const [result] = await waitForFlow2Result<Record<string, unknown>>({
    requestId: created.requestId,
    customerId: job.customerId,
    onProgress: (progress, message) => emitter.progress(progress, message),
    extract: async (statusData) => {
      const resultPayload =
        statusData.result && typeof statusData.result === "object"
          ? (statusData.result as Record<string, unknown>)
          : statusData.data &&
              typeof statusData.data === "object" &&
              (statusData.data as Record<string, unknown>).result &&
              typeof (statusData.data as Record<string, unknown>).result === "object"
            ? ((statusData.data as Record<string, unknown>).result as Record<string, unknown>)
            : null;
      const audioUrls = collectFreeGenAudioUrls(resultPayload);
      if (!audioUrls.length) return [];
      return [
        {
          audio_urls: audioUrls,
          Link: audioUrls[0],
        },
      ];
    },
    emptyResultMessage: "Flow2 không trả về audio URL",
    waitingProgressMessage: "Flow2 đang tạo audio...",
    doneProgressMessage: "Flow2 đã tạo xong audio.",
    logTag: "voice-free-gen-audio",
  });

  await emitter.progress(95, "Đang hoàn tất dữ liệu audio...");

  return {
    data: {
      flow2RequestId: created.requestId,
      voice,
      text,
      result,
      audio_urls: Array.isArray(result?.audio_urls) ? result.audio_urls : [],
      Link: String(result?.Link || "") || "",
    },
  };
}
