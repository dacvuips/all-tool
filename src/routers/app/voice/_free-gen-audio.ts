import {
  createFlow2Request,
  getFlow2Config,
  getFlow2RequestStatus,
  isFlow2FailedStatus,
  isFlow2SuccessStatus,
  pickFlow2RequestId,
  pickFlow2ResultPayload,
  pickStatus,
  type Flow2ConfigOptions,
  type Flow2StatusResponse,
} from "../../api-media/flow2/_shared";

export const FREE_GEN_AUDIO_MODEL_KEY = "gemini_v4s_tts_flow";

function flow2Opts(customerId?: string): Flow2ConfigOptions | undefined {
  const id = String(customerId || "").trim();
  return id ? { customerId: id } : undefined;
}

export function collectFreeGenAudioUrls(result: Record<string, unknown> | null | undefined): string[] {
  if (!result) return [];
  const urls: string[] = [];
  const push = (value: unknown) => {
    if (typeof value !== "string") return;
    const trimmed = value.trim();
    if (/^https?:\/\//i.test(trimmed)) urls.push(trimmed);
  };
  const list = result.audio_urls;
  if (Array.isArray(list)) {
    list.forEach(push);
  }
  push(result.Link);
  push(result.link);
  push(result.url);
  return Array.from(new Set(urls));
}

export function sanitizeFreeGenAudioJobForClient(statusData: Flow2StatusResponse) {
  const requestId = pickFlow2RequestId(statusData) || "";
  const rawStatus = pickStatus(statusData);
  const resultPayload = pickFlow2ResultPayload(statusData);
  const audioUrls = collectFreeGenAudioUrls(
    (resultPayload as Record<string, unknown> | null | undefined) || undefined
  );

  let status = "processing";
  if (isFlow2SuccessStatus(rawStatus)) status = "completed";
  else if (isFlow2FailedStatus(rawStatus)) status = "failed";

  return {
    id: requestId,
    status,
    result: {
      audio_urls: audioUrls,
      Link: audioUrls[0] || "",
    },
    freeGenAudio: true,
  };
}

export async function createFreeGenAudioRequest(
  text: string,
  voice: string,
  customerId?: string
): Promise<{ requestId: string; raw: Record<string, unknown> }> {
  const dialog = String(text || "").trim();
  const voiceId = String(voice || "").trim().toLowerCase();
  if (!dialog) throw Object.assign(new Error("Thiếu text"), { statusCode: 400 });
  if (!voiceId) throw Object.assign(new Error("Thiếu voice"), { statusCode: 400 });

  return createFlow2Request(
    {
      type: "gen_audio",
      params: {
        prompt: dialog,
        dialog,
        voice: voiceId,
        modelKey: FREE_GEN_AUDIO_MODEL_KEY,
        audio_model: FREE_GEN_AUDIO_MODEL_KEY,
      },
    },
    flow2Opts(customerId)
  );
}

export async function getFreeGenAudioRequestStatus(
  requestId: string,
  customerId?: string
): Promise<Flow2StatusResponse> {
  const id = String(requestId || "").trim();
  if (!id) throw Object.assign(new Error("Thiếu request id"), { statusCode: 400 });
  return getFlow2RequestStatus(id, flow2Opts(customerId));
}

export async function fetchFreeGenAudioBytes(
  requestId: string,
  customerId?: string
): Promise<{
  buffer: Buffer;
  contentType: string;
}> {
  const statusData = await getFreeGenAudioRequestStatus(requestId, customerId);
  const sanitized = sanitizeFreeGenAudioJobForClient(statusData);
  const audioUrl = String(sanitized.result?.Link || sanitized.result?.audio_urls?.[0] || "").trim();
  if (!audioUrl) {
    throw Object.assign(new Error("Chưa có URL audio từ gen_audio"), { statusCode: 404 });
  }

  const { token } = await getFlow2Config(flow2Opts(customerId));
  for (const useAuth of [true, false]) {
    const resp = await fetch(audioUrl, {
      headers: useAuth ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!resp.ok) continue;
    const buffer = Buffer.from(await resp.arrayBuffer());
    if (buffer.length < 32) continue;
    return {
      buffer,
      contentType: resp.headers.get("content-type") || "audio/mpeg",
    };
  }

  throw Object.assign(new Error("Không tải được audio từ Flow2"), { statusCode: 502 });
}
