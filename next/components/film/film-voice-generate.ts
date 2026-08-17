import {
  createTextToSpeech,
  fetchVoiceJobOutputBlob,
  jobIdOf,
  pollVoiceJob,
} from "../app/voice/voice-api";

import type { FilmSceneRecord } from "./film-types";

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

/** Gọi API TTS với voice_id + text, trả về blob audio. */
export async function generateFilmDialogueVoiceBlob(
  text: string,
  voiceId: string
): Promise<Blob> {
  const trimmedText = String(text || "").trim();
  const trimmedVoiceId = String(voiceId || "").trim();
  if (!trimmedText) throw new Error("Chưa có nội dung thoại");
  if (!trimmedVoiceId) throw new Error("Chưa gắn giọng cho nhân vật");

  const job = await createTextToSpeech({
    voice_id: trimmedVoiceId,
    text: trimmedText,
    speed: 1,
    creativity: 0.5,
  });
  const id = jobIdOf(job);
  if (!id) throw new Error("Không nhận được job ID");

  const done = await pollVoiceJob(id, undefined, undefined, "tts");
  const status = String(done?.status || "").toLowerCase();
  if (status === "failed") {
    throw new Error(jobErrorMessage(done, "Tạo giọng thất bại"));
  }

  const blob = await fetchVoiceJobOutputBlob(id, 0);
  if (!blob || blob.size < 32) {
    throw new Error("Không tải được file âm thanh");
  }
  return blob;
}
