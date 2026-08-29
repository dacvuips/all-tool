import config from "config";

export const FACEBOOK_GRAPH_VERSION = "v21.0";

export const FACEBOOK_OAUTH_SCOPES = [
  "pages_show_list",
  "pages_manage_posts",
  "pages_read_engagement",
  "pages_manage_engagement",
].join(",");

export function getFacebookOAuthConfig(): {
  appId: string;
  appSecret: string;
  redirectUri: string;
} {
  const appId = String(process.env.FACEBOOK_APP_ID || config.get("facebook.appId") || "").trim();
  const appSecret = String(
    process.env.FACEBOOK_APP_SECRET || config.get("facebook.appSecret") || ""
  ).trim();
  const domain = String(config.get("domain") || "").replace(/\/$/, "");
  const redirectUri = `${domain}/api/app/facebook-oauth/callback`;

  if (!appId || !appSecret) {
    const err: any = new Error(
      "Chưa cấu hình Facebook App — đặt FACEBOOK_APP_ID và FACEBOOK_APP_SECRET trên server"
    );
    err.statusCode = 503;
    throw err;
  }

  return { appId, appSecret, redirectUri };
}

export function buildFacebookOAuthUrl(state: string): string {
  const { appId, redirectUri } = getFacebookOAuthConfig();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    state,
    scope: FACEBOOK_OAUTH_SCOPES,
    response_type: "code",
  });
  return `https://www.facebook.com/${FACEBOOK_GRAPH_VERSION}/dialog/oauth?${params.toString()}`;
}
