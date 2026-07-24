/**
 * API client — module shopee-video-upload.
 */
async function apiFetch<T = any>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok && data?.message) {
    throw new Error(data.message);
  }
  return data as T;
}

export type StartThreadPayload = {
  id: string;
  username?: string;
  cookie?: string;
  country?: string;
  proxy?: string;
  caption?: string;
  productLink?: string;
  productId?: string;
  videoUrl?: string;
  videoFile?: string;
  /** base64 raw (không data: prefix) — dùng khi video chỉ có blob:/data: trên browser */
  videoBase64?: string;
};

export async function startUploadThreads(threads: StartThreadPayload[]) {
  return apiFetch<{
    success: boolean;
    count: number;
    jobs: Array<{ jobId: string; threadId?: string; status: string }>;
  }>("/api/app/shopee-video-upload/threads/start", {
    method: "POST",
    body: JSON.stringify({ threads }),
  });
}

export async function pauseUploadThreads(threadIds: string[]) {
  return apiFetch<{ success: boolean; cancelled: number }>(
    "/api/app/shopee-video-upload/threads/pause",
    {
      method: "POST",
      body: JSON.stringify({ threadIds }),
    }
  );
}

export async function retryUploadThreads(threads: StartThreadPayload[]) {
  return apiFetch<{
    success: boolean;
    count: number;
    jobs: Array<{ jobId: string; threadId?: string; status: string }>;
  }>("/api/app/shopee-video-upload/threads/retry", {
    method: "POST",
    body: JSON.stringify({ threads }),
  });
}

export async function getUploadJob(jobId: string) {
  return apiFetch<{
    success: boolean;
    job?: {
      id: string;
      status: string;
      threadId?: string;
      result?: { postId?: string; postLink?: string; dryRun?: boolean };
      error?: string;
    };
  }>(`/api/app/shopee-video-upload/jobs/${encodeURIComponent(jobId)}`);
}

export async function check24hApi(params: {
  cookie: string;
  country?: string;
  proxy?: string;
  username?: string;
}) {
  return apiFetch<{
    success: boolean;
    username?: string;
    count24h?: number;
    canPost?: boolean;
    error?: string;
    banned?: boolean;
    dryRun?: boolean;
  }>("/api/app/shopee-video-upload/check-24h", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function getSignerBalance(creds?: {
  signerBaseUrl?: string;
  signerMeBaseUrl?: string;
  signerApiKey?: string;
}) {
  const hasCreds = Boolean(
    String(creds?.signerBaseUrl || "").trim() ||
      String(creds?.signerMeBaseUrl || "").trim() ||
      String(creds?.signerApiKey || "").trim()
  );
  if (hasCreds) {
    return apiFetch<{
      success: boolean;
      username?: string;
      credits?: number;
      is_active?: boolean;
      adapter?: string;
      signerBaseUrl?: string;
      source?: string;
      error?: string;
      code?: number;
    }>("/api/app/shopee-video-upload/signer/balance", {
      method: "POST",
      body: JSON.stringify({
        signerBaseUrl: creds?.signerBaseUrl,
        signerMeBaseUrl: creds?.signerMeBaseUrl,
        signerApiKey: creds?.signerApiKey,
      }),
    });
  }
  return apiFetch<{
    success: boolean;
    username?: string;
    credits?: number;
    is_active?: boolean;
    adapter?: string;
    signerBaseUrl?: string;
    source?: string;
    error?: string;
    code?: number;
  }>("/api/app/shopee-video-upload/signer/balance");
}

export async function getSignerConfig() {
  return apiFetch<{
    success: boolean;
    signerBaseUrl?: string;
    adapter?: string;
    dryRun?: boolean;
    apiKeySet?: boolean;
    source?: string;
  }>("/api/app/shopee-video-upload/signer/config");
}
