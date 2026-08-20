export type VoiceToolId =
  | "voices"
  | "mine"
  | "tts"
  | "conversion"
  | "clone"
  | "stt"
  | "cleanup"
  | "cut";

export type MicroxJobStatus = "processing" | "completed" | "failed" | string;

export type MicroxJob = {
  id?: string;
  status?: MicroxJobStatus;
  usage?: { amount?: number };
  [key: string]: unknown;
};

export type MicroxVoice = {
  id?: string;
  voice_id?: string;
  name?: string;
  language?: string;
  gender?: string;
  category?: string;
  capabilities?: string[];
  preview_url?: string;
  sample_url?: string;
  [key: string]: unknown;
};

export type MicroxVoicesPage = {
  items?: MicroxVoice[];
  voices?: MicroxVoice[];
  data?: MicroxVoice[];
  page?: number;
  limit?: number;
  total?: number;
  [key: string]: unknown;
};

export type MicroxAccount = {
  credits?: number;
  balance?: number;
  concurrency?: number;
  active_jobs?: number;
  [key: string]: unknown;
};

export function voiceIdOf(voice: MicroxVoice | null | undefined): string {
  if (!voice) return "";
  return String(voice.id || voice.voice_id || "").trim();
}

export function voicesFromPage(page: MicroxVoicesPage | null | undefined): MicroxVoice[] {
  if (!page) return [];
  if (Array.isArray(page)) return page as MicroxVoice[];
  const nested = (page as any).data;
  const candidates = [page.items, page.voices, Array.isArray(nested) ? nested : null, nested?.items, nested?.voices];
  for (const list of candidates) {
    if (Array.isArray(list)) return list;
  }
  return [];
}

export type ExtractedJobMedia = {
  urls: string[];
  voiceIds: string[];
  texts: { label: string; value: string }[];
};

export function isVoiceToolAudioPath(value: string): boolean {
  return /^\/api\/app\/voice\/jobs\/[^/]+\/output\/?/i.test(value);
}

function isSttSegment(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const rec = value as Record<string, unknown>;
  if (typeof rec.text !== "string" || rec.text.trim().length < 2) return false;
  return (
    Array.isArray(rec.words) ||
    rec.language_code != null ||
    rec.transcription_id != null ||
    typeof rec.audio_duration_secs === "number"
  );
}

export function extractJobMedia(job: unknown): ExtractedJobMedia {
  const urls: string[] = [];
  const voiceIds: string[] = [];
  const texts: { label: string; value: string }[] = [];

  const pushText = (label: string, raw: string) => {
    const value = raw.trim();
    if (value.length < 2) return;
    if (texts.some((item) => item.label === label && item.value === value)) return;
    texts.push({ label, value });
  };

  const visit = (value: unknown, key = "") => {
    if (value == null) return;
    if (isSttSegment(value)) {
      pushText("text", String(value.text));
      if (typeof value.srt === "string") pushText("srt", value.srt);
      if (typeof value.vtt === "string") pushText("vtt", value.vtt);
      return;
    }
    if (typeof value === "string") {
      const v = value.trim();
      if (!v) return;
      if (
        (v.startsWith("[") || v.startsWith("{")) &&
        /"language_code"|"transcription_id"|"words"/.test(v)
      ) {
        try {
          visit(JSON.parse(v), key);
          return;
        } catch {
          // not JSON transcript
        }
      }
      if (isVoiceToolAudioPath(v) && !urls.includes(v)) urls.push(v);
      else if (/^(voice_|clone_)/.test(v) && !voiceIds.includes(v)) voiceIds.push(v);
      else if (
        (key === "text" ||
          key === "transcript" ||
          key === "transcription" ||
          key === "srt" ||
          key === "vtt") &&
        v.length > 1
      ) {
        pushText(key, v);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        if (k === "words") continue;
        visit(v, k);
      }
    }
  };

  visit(job);
  return { urls, voiceIds, texts };
}

export type SttWord = { text: string; start: number; end: number };

export function extractSttWords(job: unknown): SttWord[] {
  const words: SttWord[] = [];
  const visit = (value: unknown) => {
    if (value == null) return;
    if (isSttSegment(value) && Array.isArray(value.words)) {
      value.words.forEach((item) => {
        if (!item || typeof item !== "object") return;
        const rec = item as Record<string, unknown>;
        if (String(rec.type || "") === "spacing") return;
        const text = String(rec.text || "").trim();
        if (!text) return;
        words.push({
          text,
          start: Number(rec.start) || 0,
          end: Number(rec.end) || 0,
        });
      });
      return;
    }
    if (typeof value === "string") {
      const v = value.trim();
      if ((v.startsWith("[") || v.startsWith("{")) && /"words"/.test(v)) {
        try {
          visit(JSON.parse(v));
        } catch {
          // ignore
        }
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(visit);
    }
  };
  visit(job);
  return words;
}
