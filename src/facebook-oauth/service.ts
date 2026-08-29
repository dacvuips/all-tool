import axios, { AxiosError } from "axios";
import { FACEBOOK_GRAPH_VERSION, getFacebookOAuthConfig } from "./config";
import type { FacebookOAuthPageSession } from "./session";

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function facebookApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const ax = err as AxiosError<any>;
    const data = ax.response?.data;
    return (
      data?.error?.message ||
      data?.error_description ||
      (typeof data?.error === "string" ? data.error : null) ||
      ax.message ||
      "Facebook OAuth thất bại"
    );
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function exchangeCodeForUserToken(code: string): Promise<string> {
  const { appId, appSecret, redirectUri } = getFacebookOAuthConfig();
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          client_id: appId,
          client_secret: appSecret,
          redirect_uri: redirectUri,
          code,
        },
        timeout: 30000,
      }
    );
    const token = asString(resp.data?.access_token);
    if (!token) throw new Error("Facebook không trả access_token");
    return token;
  } catch (err) {
    throw new Error(facebookApiError(err));
  }
}

export async function exchangeLongLivedUserToken(shortToken: string): Promise<string> {
  const { appId, appSecret } = getFacebookOAuthConfig();
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/oauth/access_token`,
      {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        },
        timeout: 30000,
      }
    );
    const token = asString(resp.data?.access_token);
    return token || shortToken;
  } catch {
    return shortToken;
  }
}

export async function fetchManagedPages(userAccessToken: string): Promise<FacebookOAuthPageSession[]> {
  try {
    const resp = await axios.get(
      `https://graph.facebook.com/${FACEBOOK_GRAPH_VERSION}/me/accounts`,
      {
        params: {
          access_token: userAccessToken,
          fields: "id,name,access_token,picture{url}",
          limit: 100,
        },
        timeout: 30000,
      }
    );

    const data = Array.isArray(resp.data?.data) ? resp.data.data : [];
    const pages: FacebookOAuthPageSession[] = [];
    for (const item of data) {
      const accessToken = asString(item?.access_token);
      const id = asString(item?.id);
      const name = asString(item?.name) || id;
      if (!id || !accessToken) continue;
      pages.push({
        id,
        name,
        pictureUrl: asString(item?.picture?.data?.url || item?.picture?.url) || undefined,
        accessToken,
      });
    }
    return pages;
  } catch (err) {
    throw new Error(facebookApiError(err));
  }
}
