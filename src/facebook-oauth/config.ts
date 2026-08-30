import config from "config";

export const FACEBOOK_GRAPH_VERSION = "v21.0";

/** Dùng khi app Meta kiểu Business (Login for Business) — không truyền scope trực tiếp */
export const FACEBOOK_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_engagement",
  "publish_video",
].join(",");

export function readFacebookOAuthEnv(): {
  appId: string;
  appSecret: string;
  configId: string;
  redirectUri: string;
} {
  const appId = String(process.env.FACEBOOK_APP_ID || config.get("facebook.appId") || "").trim();
  const appSecret = String(
    process.env.FACEBOOK_APP_SECRET || config.get("facebook.appSecret") || ""
  ).trim();
  const configId = String(
    process.env.FACEBOOK_OAUTH_CONFIG_ID || config.get("facebook.oauthConfigId") || ""
  ).trim();
  const domain = String(config.get("domain") || "").replace(/\/$/, "");
  const redirectUri = `${domain}/api/app/facebook-oauth/callback`;
  return { appId, appSecret, configId, redirectUri };
}

/** OAuth popup chỉ bật khi admin đã cấu hình đủ trên server — khách hàng vẫn dùng token thủ công. */
export function isFacebookOAuthAvailable(): boolean {
  const { appId, appSecret, configId } = readFacebookOAuthEnv();
  return !!(appId && appSecret && configId);
}

export function getFacebookOAuthConfig(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
  configId: string;
} {
  const { appId, appSecret, configId, redirectUri } = readFacebookOAuthEnv();

  if (!isFacebookOAuthAvailable()) {
    const err: any = new Error(
      "Kết nối Facebook nhanh chưa khả dụng — hãy dán Page Access Token thủ công (tab Hướng dẫn)."
    );
    err.statusCode = 503;
    err.code = "FACEBOOK_OAUTH_NOT_CONFIGURED";
    throw err;
  }

  return { appId, appSecret, redirectUri, configId };
}

export function buildFacebookOAuthUrl(state: string): string {
  const { appId, redirectUri, configId } = getFacebookOAuthConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    response_type: "code",
  });

  // App Business (Use cases / Video API): dùng config_id — KHÔNG truyền scope (gây Invalid Scopes)
  params.set("config_id", configId);

  return `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}
