export type FacebookOAuthPage = {
  id: string;
  name: string;
  pictureUrl?: string | null;
};

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    ...init,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || "Facebook OAuth request failed");
  }
  return data as T;
}

export async function fetchFacebookOAuthStatus(): Promise<{ available: boolean }> {
  const data = await apiFetch<{ success: boolean; available: boolean }>(
    "/api/app/facebook-oauth/status"
  );
  return { available: !!data.available };
}

export async function startFacebookOAuth(): Promise<{ authUrl: string }> {
  const data = await apiFetch<{ success: boolean; authUrl: string }>(
    "/api/app/facebook-oauth/start"
  );
  if (!data.authUrl) throw new Error("Không nhận được authUrl");
  return { authUrl: data.authUrl };
}

export async function fetchFacebookOAuthPages(sessionId: string): Promise<FacebookOAuthPage[]> {
  const data = await apiFetch<{ success: boolean; pages: FacebookOAuthPage[] }>(
    `/api/app/facebook-oauth/pages?session=${encodeURIComponent(sessionId)}`
  );
  return data.pages || [];
}

export async function connectFacebookPage(
  sessionId: string,
  pageId: string
): Promise<{ id: string; name: string }> {
  const data = await apiFetch<{
    success: boolean;
    page: { id: string; name: string };
  }>("/api/app/facebook-oauth/connect", {
    method: "POST",
    body: JSON.stringify({ sessionId, pageId }),
  });
  return data.page;
}

export const FACEBOOK_OAUTH_MESSAGE_TYPE = "affiliate-facebook-oauth";

export type FacebookOAuthMessage = {
  type: typeof FACEBOOK_OAUTH_MESSAGE_TYPE;
  status: "success" | "error";
  connectSessionId?: string | null;
  message?: string | null;
};

export function isFacebookOAuthMessage(data: unknown): data is FacebookOAuthMessage {
  if (!data || typeof data !== "object") return false;
  const msg = data as FacebookOAuthMessage;
  return msg.type === FACEBOOK_OAUTH_MESSAGE_TYPE;
}
