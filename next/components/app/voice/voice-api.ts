import type { MicroxAccount, MicroxJob, MicroxVoicesPage } from "./voice-types";

async function parseJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    signal: init?.signal || voiceAbortSignal || undefined,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(init?.headers || {}),
    },
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(body?.message || `Request thất bại (${res.status})`);
  }
  return (body?.data ?? body) as T;
}

let voiceAbortSignal: AbortSignal | null = null;

export function setVoiceAbortSignal(signal: AbortSignal | null) {
  voiceAbortSignal = signal;
}

export function isVoiceAbortError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const name = String((err as { name?: string }).name || "");
  const message = String((err as { message?: string }).message || "");
  return (
    name === "AbortError" ||
    /aborted|đã dừng|The user aborted|The operation was aborted/i.test(message)
  );
}

export type VoiceListParams = {
  language?: string;
  category?: string;
  gender?: string;
  capability?: string;
  query?: string;
  accent?: string;
  engine?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export function fetchVoiceAccount() {
  return requestJson<MicroxAccount>("/api/app/voice/account/");
}

export function fetchVoices(params: VoiceListParams = {}) {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || String(v).trim() === "") return;
    qs.set(k, String(v));
  });
  const suffix = qs.toString() ? `?${qs.toString()}` : "";
  return requestJson<MicroxVoicesPage>(`/api/app/voice/voices/${suffix}`);
}

export function fetchVoiceJob(id: string, tool?: string) {
  const qs = tool ? `?tool=${encodeURIComponent(tool)}` : "";
  return requestJson<MicroxJob>(`/api/app/voice/jobs/${encodeURIComponent(id)}/${qs}`);
}

export function voicePreviewUrl(voiceId: string): string {
  const id = String(voiceId || "").trim();
  if (!id) return "";
  return `/api/app/voice/voices/${encodeURIComponent(id)}/preview/`;
}

export function createTextToSpeech(input: {
  voice_id: string;
  text: string;
  speed: number;
  creativity: number;
}) {
  return requestJson<MicroxJob>("/api/app/voice/text-to-speech/", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function createVoiceConversion(input: {
  audio: File;
  voice_id: string;
  stability: number;
  similarity: number;
  style?: number;
  remove_background_noise?: boolean;
}) {
  const form = new FormData();
  form.append("audio", input.audio);
  form.append("voice_id", input.voice_id);
  form.append("stability", String(input.stability));
  form.append("similarity", String(input.similarity));
  if (input.style != null) form.append("style", String(input.style));
  if (input.remove_background_noise != null) {
    form.append("remove_background_noise", String(input.remove_background_noise));
  }
  return requestJson<MicroxJob>("/api/app/voice/voice-conversion/", {
    method: "POST",
    body: form,
  });
}

export function createVoiceClone(input: {
  audio: File;
  name: string;
  remove_background_noise?: boolean;
}) {
  const form = new FormData();
  form.append("audio", input.audio);
  form.append("name", input.name);
  if (input.remove_background_noise != null) {
    form.append("remove_background_noise", String(input.remove_background_noise));
  }
  return requestJson<MicroxJob>("/api/app/voice/voice-clones/", {
    method: "POST",
    body: form,
  });
}

export function createSpeechToText(audio: File) {
  const form = new FormData();
  form.append("audio", audio);
  return requestJson<MicroxJob>("/api/app/voice/speech-to-text/", {
    method: "POST",
    body: form,
  });
}

export function createAudioCleanup(audio: File) {
  const form = new FormData();
  form.append("audio", audio);
  return requestJson<MicroxJob>("/api/app/voice/audio-cleanup/", {
    method: "POST",
    body: form,
  });
}

const POLL_MS = 2000;
const MAX_WAIT_MS = 5 * 60 * 1000;

export async function pollVoiceJob(
  jobId: string,
  onTick?: (job: MicroxJob) => void,
  signal?: AbortSignal,
  tool?: string
): Promise<MicroxJob> {
  const started = Date.now();
  const sig = signal || voiceAbortSignal;
  while (Date.now() - started < MAX_WAIT_MS) {
    if (sig?.aborted) throw new DOMException("Đã dừng", "AbortError");
    const job = await fetchVoiceJob(jobId, tool);
    onTick?.(job);
    const status = String(job?.status || "").toLowerCase();
    if (status === "completed" || status === "failed") return job;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, POLL_MS);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Đã dừng", "AbortError"));
      };
      if (sig?.aborted) {
        onAbort();
        return;
      }
      sig?.addEventListener("abort", onAbort, { once: true });
    });
  }
  throw new Error("Hết thời gian chờ job MicroX");
}

export function jobIdOf(job: MicroxJob | null | undefined): string {
  const nested = job && typeof job === "object" ? (job as { data?: { id?: string } }).data?.id : "";
  return String(job?.id || nested || "").trim();
}

export function voiceJobOutputUrl(jobId: string, index = 0): string {
  const id = String(jobId || "").trim();
  if (!id) return "";
  return `/api/app/voice/jobs/${encodeURIComponent(id)}/output/?index=${index}`;
}

export async function fetchVoiceJobOutputBlob(jobId: string, index = 0): Promise<Blob | null> {
  const url = voiceJobOutputUrl(jobId, index);
  if (!url) return null;
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = (blob.type || "").toLowerCase();
  if (type.includes("json") || type.includes("text/html")) return null;
  return blob;
}
