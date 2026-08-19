import {
  createFreeGenAudio,
  fetchFreeGenAudioOutputBlobWithRetry,
  pollFreeGenAudioJob,
} from "../app/voice/free-voice-api";
import { isFreeGenAudioVoiceId } from "../app/voice/free-voice-voices";
import {
  createTextToSpeech,
  fetchVoiceJobOutputBlob,
  jobIdOf,
  pollVoiceJob,
} from "../app/voice/voice-api";

import type { FilmSceneRecord } from "./film-types";

export const FILM_VOICE_BULK_CONCURRENCY = 3;

export type FilmVoiceGenerateInput = {
  scene: FilmSceneRecord;
  dialogueLineId: string;
  text: string;
  voiceId: string;
  voiceLabel?: string;
};

function jobErrorMessage(job: unknown, fallback: string): string {
  if (!job || typeof job !== "object") return fallback;
  const row = job as Record<string, unknown>;
  const nested =
    row.data && typeof row.data === "object"
      ? (row.data as Record<string, unknown>)
      : null;
  const msg = String(
    row.error || row.message || nested?.error || nested?.message || ""
  ).trim();
  return msg || fallback;
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
}

async function generateFilmDialogueFreeVoiceBlob(
  text: string,
  voiceId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const job = await createFreeGenAudio({ text, voice: voiceId.toLowerCase() }, signal);
  throwIfAborted(signal);
  const id = jobIdOf(job);
  if (!id) throw new Error("Không nhận được job ID");

  const done = await pollFreeGenAudioJob(id, undefined, signal);
  throwIfAborted(signal);
  const status = String(done?.status || "").toLowerCase();
  if (status === "failed") {
    throw new Error(jobErrorMessage(done, "Tạo giọng thất bại"));
  }

  const blob = await fetchFreeGenAudioOutputBlobWithRetry(id, 0, signal, done);
  throwIfAborted(signal);
  if (!blob || blob.size < 32) {
    throw new Error("Không tải được file âm thanh");
  }
  return blob;
}

/** Gọi API TTS (thu phí hoặc miễn phí) với voice + text, trả về blob audio. */
export async function generateFilmDialogueVoiceBlob(
  text: string,
  voiceId: string,
  signal?: AbortSignal
): Promise<Blob> {
  const trimmedText = String(text || "").trim();
  const trimmedVoiceId = String(voiceId || "").trim();
  if (!trimmedText) throw new Error("Chưa có nội dung thoại");
  if (!trimmedVoiceId) throw new Error("Chưa gắn giọng cho nhân vật");
  throwIfAborted(signal);

  if (isFreeGenAudioVoiceId(trimmedVoiceId)) {
    return generateFilmDialogueFreeVoiceBlob(trimmedText, trimmedVoiceId, signal);
  }

  const job = await createTextToSpeech(
    {
      voice_id: trimmedVoiceId,
      text: trimmedText,
      speed: 1,
      creativity: 0.5,
    },
    signal
  );
  throwIfAborted(signal);
  const id = jobIdOf(job);
  if (!id) throw new Error("Không nhận được job ID");

  const done = await pollVoiceJob(id, undefined, signal, "tts");
  throwIfAborted(signal);
  const status = String(done?.status || "").toLowerCase();
  if (status === "failed") {
    throw new Error(jobErrorMessage(done, "Tạo giọng thất bại"));
  }

  const blob = await fetchVoiceJobOutputBlob(id, 0, signal);
  throwIfAborted(signal);
  if (!blob || blob.size < 32) {
    throw new Error("Không tải được file âm thanh");
  }
  return blob;
}
