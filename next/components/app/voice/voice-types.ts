export type VoiceToolId =
  | "voices"
  | "tts"
  | "conversion"
  | "clone"
  | "stt"
  | "cleanup";

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

export function extractJobMedia(job: unknown): ExtractedJobMedia {
  const urls: string[] = [];
  const voiceIds: string[] = [];
  const texts: { label: string; value: string }[] = [];

  const visit = (value: unknown, key = "") => {
    if (value == null) return;
    if (typeof value === "string") {
      const v = value.trim();
      if (!v) return;
      if (/^https?:\/\//i.test(v) && !urls.includes(v)) urls.push(v);
      else if (/^(voice_|clone_)/.test(v) && !voiceIds.includes(v)) voiceIds.push(v);
      else if (
        (key === "text" ||
          key === "transcript" ||
          key === "transcription" ||
          key === "srt" ||
          key === "vtt") &&
        v.length > 1
      ) {
        texts.push({ label: key, value: v });
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, key));
      return;
    }
    if (typeof value === "object") {
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        visit(v, k);
      }
    }
  };

  visit(job);
  return { urls, voiceIds, texts };
}
