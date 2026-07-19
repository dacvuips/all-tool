/**
 * Client API — lấy cookie Shopee qua extension.
 */

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export type CookieFetchJobPublic = {
  id: string;
  userId: string;
  username: string;
  loginUrl: string;
  status: "pending" | "running" | "success" | "captcha" | "error" | "cancelled";
  cookie: string;
  spcF: string;
  error: string;
  createdAt: number;
  updatedAt: number;
};

export async function startCookieFetchJob(input: {
  userId: string;
  username: string;
  password: string;
  loginUrl?: string;
  /** SPC_F gắn trước khi login */
  spcF?: string;
}): Promise<{
  job: CookieFetchJobPublic;
  credentials: { username: string; password: string; loginUrl: string; spcF: string };
}> {
  const res = await fetch("/api/app/shopee-cookie-fetch/start", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không tạo được job (${res.status})`);
  }
  return {
    job: json.job as CookieFetchJobPublic,
    credentials: json.credentials,
  };
}

export async function getCookieFetchJob(id: string): Promise<CookieFetchJobPublic> {
  const res = await fetch(`/api/app/shopee-cookie-fetch/jobs/${encodeURIComponent(id)}`, {
    method: "GET",
    credentials: "include",
  });
  const json = await parseJson(res);
  if (!res.ok || !json?.ok) {
    throw new Error(json?.message || `Không lấy được job (${res.status})`);
  }
  return json.job as CookieFetchJobPublic;
}

/** Báo extension (qua app-bridge) mở tab login + chạy job. */
export function notifyExtensionStartCookieFetch(payload: {
  jobId: string;
  userId: string;
  username: string;
  password: string;
  loginUrl: string;
  spcF?: string;
}) {
  window.postMessage(
    {
      source: "viet-theo-bridge-app",
      type: "START_COOKIE_FETCH",
      ...payload,
      apiBase: window.location.origin,
    },
    "*"
  );
}

/** Báo extension gắn cookie của tài khoản vào Chrome local. */
export function notifyExtensionApplyCookiesLocal(payload: {
  userId: string;
  cookie: string;
  loginUrl?: string;
}) {
  window.postMessage(
    {
      source: "viet-theo-bridge-app",
      type: "APPLY_COOKIES_LOCAL",
      ...payload,
      loginUrl: payload.loginUrl || "https://shopee.vn/buyer/login",
      apiBase: window.location.origin,
    },
    "*"
  );
}
