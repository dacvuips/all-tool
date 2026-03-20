/**
 * Vertex AI OAuth2 Token Refresh
 *
 * Sử dụng client_id + client_secret + refresh_token để tự động lấy access_token
 * từ Google OAuth2. Token được cache trong memory (TTL = expires_in - 60s buffer).
 *
 * Cách dùng:
 *   const token = await getVertexAccessToken({ clientId, clientSecret, refreshToken });
 */

import axios from "axios";
import logger from "../../../helpers/logger";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";

interface OAuthTokenParams {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number;
}

/**
 * In-memory cache keyed by a hash of clientId + refreshToken (first 8 chars each).
 * Avoids storing full secrets as keys.
 */
const tokenCache = new Map<string, CachedToken>();

function buildCacheKey(params: OAuthTokenParams): string {
  const idPart = params.clientId.slice(-8);
  const rtPart = params.refreshToken.slice(-8);
  return `vtx_oauth:${idPart}:${rtPart}`;
}

/**
 * Trả về access token hợp lệ, tự động refresh nếu đã hết hạn hoặc chưa có.
 */
export async function getVertexAccessToken(params: OAuthTokenParams): Promise<string> {
  const cacheKey = buildCacheKey(params);

  const cached = tokenCache.get(cacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.accessToken;
  }

  logger.info("[Vertex OAuth2] Refreshing access token...");

  const res = await axios.post(
    GOOGLE_TOKEN_ENDPOINT,
    {
      client_id: params.clientId,
      client_secret: params.clientSecret,
      refresh_token: params.refreshToken,
      grant_type: "refresh_token",
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: 15_000,
    }
  );

  const data = res.data as { access_token: string; expires_in: number };

  if (!data.access_token) {
    throw new Error("[Vertex OAuth2] Failed to obtain access token – response missing access_token");
  }

  const expiresAt = Date.now() + (data.expires_in - 60) * 1000;

  tokenCache.set(cacheKey, { accessToken: data.access_token, expiresAt });

  logger.info(`[Vertex OAuth2] Token refreshed, expires in ${data.expires_in}s`);

  return data.access_token;
}

/** Xoá cache (dùng khi credential bị đổi). */
export function clearVertexTokenCache(): void {
  tokenCache.clear();
}
