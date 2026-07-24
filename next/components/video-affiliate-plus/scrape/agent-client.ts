/**
 * Client gọi Shopee Scrape Local Agent trên máy user.
 * Mặc định http://127.0.0.1:17890 — không đi qua server production.
 *
 * Trên domain HTTPS, Chrome Local Network Access chặn fetch → loopback
 * trừ khi có targetAddressSpace + user Allow quyền Local network.
 */

export const SCRAPE_AGENT_BASE = (
  (typeof process !== "undefined" &&
    process.env?.NEXT_PUBLIC_SCRAPE_AGENT_URL) ||
  "http://127.0.0.1:17890"
).replace(/\/$/, "");

/** Chrome LNA: HTTPS public site → 127.0.0.1 (tránh mixed content + hiện permission). */
type LoopbackFetchInit = RequestInit & {
  targetAddressSpace?: "loopback" | "local" | "private" | "public";
};

function agentFetchInit(init?: RequestInit): LoopbackFetchInit {
  return {
    ...init,
    // loopback = 127.0.0.1 / ::1 (Chrome 138+)
    targetAddressSpace: "loopback",
  };
}

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function probeScrapeAgent(timeoutMs = 2500): Promise<{
  online: boolean;
  gemloginOnline?: boolean;
  profileCount?: number;
  hasCookies?: boolean;
  message?: string;
}> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      `${SCRAPE_AGENT_BASE}/status`,
      agentFetchInit({
        method: "GET",
        signal: controller.signal,
      })
    );
    const json = await parseJson(res);
    if (!res.ok || !json?.ok) {
      return { online: false, message: json?.message || `Agent lỗi (${res.status})` };
    }
    return {
      online: true,
      gemloginOnline: Boolean(json?.gemlogin?.online),
      profileCount:
        typeof json?.gemlogin?.profileCount === "number"
          ? json.gemlogin.profileCount
          : undefined,
      hasCookies: Boolean(
        json?.cdp?.hasCookies || json?.cdp?.connected || json?.cdp?.cdpAlive
      ),
    };
  } catch {
    return {
      online: false,
      message: `Chưa thấy Local Agent (${SCRAPE_AGENT_BASE}). Mở Agent, rồi Allow «Local network» khi Chrome hỏi (bắt buộc trên domain HTTPS).`,
    };
  } finally {
    window.clearTimeout(timer);
  }
}

export async function agentFetch(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<{ res: Response; json: any }> {
  const timeoutMs = init?.timeoutMs ?? 90000;
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const { timeoutMs: _t, ...rest } = init || {};
    const res = await fetch(
      `${SCRAPE_AGENT_BASE}${path}`,
      agentFetchInit({
        ...rest,
        signal: controller.signal,
      })
    );
    const json = await parseJson(res);
    return { res, json };
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Agent hết thời gian chờ. Kiểm tra GemLogin còn mở và thử lại.");
    }
    throw new Error(
      err?.message ||
        `Không gọi được Local Agent (${SCRAPE_AGENT_BASE}). Mở Agent trên máy bạn; trên domain HTTPS hãy Allow quyền Local network khi Chrome hỏi.`
    );
  } finally {
    window.clearTimeout(timer);
  }
}
