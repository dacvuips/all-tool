import axios, { AxiosError } from "axios";

const GRAPH_API_VERSION = "v21.0";

export type FacebookPageTokenInfo = {
  pageId: string;
  pageName: string;
};

type MeProfile = {
  id?: string;
  name?: string;
  category?: string;
};

function parseTokenFromCredential(plain: string): string {
  const text = String(plain || "").trim();
  if (!text) return "";
  if (!text.startsWith("{")) return text;
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    return String(
      obj.access_token ?? obj.accessToken ?? obj.page_access_token ?? obj.token ?? obj.value ?? ""
    ).trim();
  } catch {
    return text;
  }
}

function graphErrorMessage(err: unknown): string | null {
  if (!axios.isAxiosError(err)) return null;
  const data = (err as AxiosError<any>).response?.data;
  return data?.error?.message || data?.error_description || null;
}

function isUnsupportedFieldError(msg: string, field: string): boolean {
  return new RegExp(`nonexisting field.*${field}|${field}.*nonexisting`, "i").test(msg);
}

function pageInfoFromMe(me: MeProfile): FacebookPageTokenInfo {
  const pageId = String(me.id || "").trim();
  const pageName = String(me.name || pageId).trim();
  if (!pageId) {
    throw new Error("Không lấy được Page ID từ token");
  }
  return { pageId, pageName };
}

async function fetchMeProfile(accessToken: string): Promise<MeProfile> {
  const fieldSets = ["id,name,category", "id,name"];
  let lastErr: unknown = null;

  for (const fields of fieldSets) {
    try {
      const resp = await axios.get(`https://graph.facebook.com/${GRAPH_API_VERSION}/me`, {
        params: { access_token: accessToken, fields },
        timeout: 30000,
      });
      return (resp.data || {}) as MeProfile;
    } catch (err) {
      lastErr = err;
      const apiMsg = graphErrorMessage(err);
      const unsupportedField = fields
        .split(",")
        .find((field) => apiMsg && isUnsupportedFieldError(apiMsg, field.trim()));
      if (unsupportedField) continue;
      throw err;
    }
  }

  const apiMsg = graphErrorMessage(lastErr);
  throw new Error(
    apiMsg
      ? `Token Facebook không hợp lệ: ${apiMsg}`
      : "Token Facebook không hợp lệ hoặc đã hết hạn"
  );
}

/**
 * Xác minh token là Page Access Token (không phải User token).
 * Chỉ gọi các field cơ bản — không dùng `tasks` (nhiều Page token không hỗ trợ).
 */
export async function assertFacebookPageAccessToken(
  credentialPlain: string
): Promise<FacebookPageTokenInfo> {
  const accessToken = parseTokenFromCredential(credentialPlain);
  if (!accessToken) {
    throw new Error("Thiếu Page Access Token");
  }

  const me = await fetchMeProfile(accessToken);

  if (me.category) {
    return pageInfoFromMe(me);
  }

  // User token có /me/accounts; Page token không có edge này.
  try {
    const accountsResp = await axios.get(
      `https://graph.facebook.com/${GRAPH_API_VERSION}/me/accounts`,
      {
        params: { access_token: accessToken, fields: "id,name", limit: 1 },
        timeout: 30000,
      }
    );
    if (Array.isArray(accountsResp.data?.data) && accountsResp.data.data.length > 0) {
      throw new Error(
        "Đây là User Access Token, không phải Page Access Token. " +
          "Trong Graph API Explorer: gọi GET /me/accounts?fields=name,access_token,id " +
          "→ copy access_token của đúng Fanpage cần đăng video."
      );
    }
  } catch (err) {
    if (err instanceof Error && err.message.includes("User Access Token")) throw err;

    const apiMsg = graphErrorMessage(err);
    if (apiMsg && isUnsupportedFieldError(apiMsg, "accounts") && me.id) {
      return pageInfoFromMe(me);
    }
    if (apiMsg) {
      throw new Error(`Token Facebook không hợp lệ: ${apiMsg}`);
    }
  }

  if (me.id) {
    return pageInfoFromMe(me);
  }

  throw new Error(
    "Token Facebook không hợp lệ hoặc thiếu quyền đăng video Fanpage. " +
      "Cần Page Access Token có quyền pages_manage_posts và publish_video."
  );
}
