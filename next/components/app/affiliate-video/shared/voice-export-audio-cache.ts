/**
 * Lưu / đọc audio đã gen trong modal Xuất Voice (IndexedDB generated-audio).
 */
import type { GeneratedAudioData } from "../hook/useAffiliateVideoApi";

export type VoiceExportAudioRecord = GeneratedAudioData & {
  text?: string;
  tier?: "free" | "paid";
  freeVoiceId?: string;
  paidVoiceId?: string;
  paidVoiceName?: string;
};

export type SaveGeneratedAudioFn = (
  cacheKey: string,
  data: GeneratedAudioData
) => Promise<void>;

export type GetGeneratedAudioFn = (
  cacheKey: string
) => Promise<GeneratedAudioData | undefined>;

export function voiceDialogueCacheKey(sceneId: string): string {
  return `voice-export:dialogue:${sceneId}`;
}

export function voiceMergedCacheKey(): string {
  return "voice-export:merged";
}

/** Bỏ prefix tên nhân vật trước dấu ":" — "Bi: Xin chào" → "Xin chào" */
export function stripDialogueSpeakerPrefix(text: string): string {
  let line = text.trim();
  if (
    (line.startsWith('"') && line.endsWith('"')) ||
    (line.startsWith("'") && line.endsWith("'"))
  ) {
    line = line.slice(1, -1).trim();
  }
  const colonIdx = line.indexOf(":");
  if (colonIdx <= 0) return line;

  const speaker = line.slice(0, colonIdx).trim();
  if (!speaker || speaker.length > 40) return line;
  if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(speaker)) return line;

  const dialogue = line.slice(colonIdx + 1).trim();
  return dialogue || line;
}

/** Chuẩn hóa text gửi TTS — bỏ tên nhân vật, gộp thoại bằng dấu phẩy */
export function dialogueTextForTts(text: string): string {
  const quoted: string[] = [];
  const regex = /"([^"]*)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    quoted.push(match[1] || "");
  }
  const parts = quoted.length
    ? quoted
    : text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  const source = parts.length ? parts : [text];
  return source
    .map((part) => stripDialogueSpeakerPrefix(part))
    .filter(Boolean)
    .join(", ");
}

export async function blobToGeneratedAudio(blob: Blob): Promise<GeneratedAudioData> {
  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return {
    audioBytes: btoa(binary),
    mimeType: blob.type || "audio/mpeg",
  };
}

export function generatedAudioToBlob(data: GeneratedAudioData): Blob {
  const binary = atob(data.audioBytes);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: data.mimeType || "audio/mpeg" });
}

export function isVoiceExportAudioRecord(
  data: GeneratedAudioData | undefined
): data is VoiceExportAudioRecord {
  return !!data?.audioBytes;
}

export async function saveVoiceExportAudio(
  save: SaveGeneratedAudioFn | undefined,
  cacheKey: string,
  blob: Blob,
  meta: Omit<VoiceExportAudioRecord, keyof GeneratedAudioData>
): Promise<void> {
  if (!save || !cacheKey) return;
  const base = await blobToGeneratedAudio(blob);
  await save(cacheKey, { ...base, ...meta });
}

export async function loadVoiceExportAudio(
  get: GetGeneratedAudioFn | undefined,
  cacheKey: string,
  expectedText?: string
): Promise<VoiceExportAudioRecord | null> {
  if (!get || !cacheKey) return null;
  const raw = await get(cacheKey);
  if (!isVoiceExportAudioRecord(raw)) return null;
  if (expectedText != null && raw.text != null && raw.text !== expectedText) return null;
  return raw;
}
