import type { MicroxJob } from "./voice-types";
import { setVoiceAbortSignal } from "./voice-api";

let freeGenAudioAbortSignal: AbortSignal | null = null;

export function setFreeGenAudioAbortSignal(signal: AbortSignal | null) {
  freeGenAudioAbortSignal = signal;
}

async function parseJson(res: Response): Promise<any> {
  return res.json().catch(() => ({}));
}

async function requestFreeGenAudioJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    ...init,
    signal: init?.signal || freeGenAudioAbortSignal || undefined,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const body = await parseJson(res);
  if (!res.ok) {
    throw new Error(body?.message || `Request thất bại (${res.status})`);
  }
  return (body?.data ?? body) as T;
}

export function isFreeGenAudioJob(job: MicroxJob | null | undefined): boolean {
  return Boolean(job && (job as { freeGenAudio?: boolean }).freeGenAudio);
}

export function createFreeGenAudio(
  input: { text: string; voice: string },
  signal?: AbortSignal
) {
  return requestFreeGenAudioJson<MicroxJob>("/api/app/voice/free-gen-audio/", {
    method: "POST",
    body: JSON.stringify(input),
    signal,
  });
}

export function fetchFreeGenAudioJob(id: string, signal?: AbortSignal) {
  return requestFreeGenAudioJson<MicroxJob>(
    `/api/app/voice/free-gen-audio/${encodeURIComponent(id)}/`,
    signal ? { signal } : undefined
  );
}

export function cancelFreeGenAudioJob(id: string, signal?: AbortSignal) {
  return requestFreeGenAudioJson<MicroxJob>(
    `/api/app/media-generation-job/${encodeURIComponent(id)}/cancel`,
    {
      method: "POST",
      signal,
    }
  );
}

export function freeGenAudioOutputUrl(jobId: string, index = 0): string {
  const id = String(jobId || "").trim();
  if (!id) return "";
  return `/api/app/voice/free-gen-audio/${encodeURIComponent(id)}/output/?index=${index}`;
}

export async function fetchFreeGenAudioOutputBlob(
  jobId: string,
  index = 0,
  signal?: AbortSignal
): Promise<Blob | null> {
  const url = freeGenAudioOutputUrl(jobId, index);
  if (!url) return null;
  const res = await fetch(url, {
    credentials: "include",
    signal: signal || freeGenAudioAbortSignal || undefined,
  });
  if (!res.ok) return null;
  const blob = await res.blob();
  const type = (blob.type || "").toLowerCase();
  if (type.includes("json") || type.includes("text/html")) return null;
  return blob;
}

const FREE_GEN_AUDIO_POLL_MS = 2000;
const FREE_GEN_AUDIO_MAX_WAIT_MS = 5 * 60 * 1000;

export async function pollFreeGenAudioJob(
  jobId: string,
  onTick?: (job: MicroxJob) => void,
  signal?: AbortSignal
): Promise<MicroxJob> {
  const started = Date.now();
  while (Date.now() - started < FREE_GEN_AUDIO_MAX_WAIT_MS) {
    if (signal?.aborted) throw new DOMException("Đã dừng", "AbortError");
    const job = await fetchFreeGenAudioJob(jobId, signal);
    onTick?.(job);
    const status = String(job?.status || "").toLowerCase();
    if (status === "completed" || status === "failed") return job;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(resolve, FREE_GEN_AUDIO_POLL_MS);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Đã dừng", "AbortError"));
      };
      if (signal?.aborted) {
        onAbort();
        return;
      }
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }
  throw new Error("Hết thời gian chờ gen_audio");
}
