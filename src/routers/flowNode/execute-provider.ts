/**
 * Executor gọi API theo từng AI provider.
 * Mỗi provider có function riêng, tự resolve credential theo cách riêng:
 *   - OPENAI_KEY / CLAUDE_KEY / DEEP_SEEK_KEY  → decrypt value → API key
 *   - GOOGLE_GEMINI_KEY  → OAuth2 refresh (clientId/secret/refreshToken) hoặc plain API key
 *   - KLING_KEY / SEE_DANCE_KEY → decrypt value → API key (mở rộng sau)
 */

import type { HydratedDocument } from "mongoose";
import { parseBodyAfterReplace, replacePlaceholders } from "../../helpers/flow-node-placeholder";
import type { ICredential } from "../../libs/dal/credential";
import { AiProviderKeyEnum, ApiOutputTypeEnum, ProductFlowNodeData } from "../../libs/dal/product";
import { decryptProviderSecret } from "../../packages/encryption";
import { CallProviderGeminiApi } from "./call-provider-api/execute-provider-gemini";
import { CallProviderGeminiVertexApi } from "./call-provider-api/execute-provider-gemini-vertex";
import { getVertexAccessToken } from "./call-provider-api/vertex-oauth-token";

/** Context truyền vào từng executor theo từng AI provider */
export interface ExecuteProviderContext {
  nodeData: ProductFlowNodeData;
  credential: HydratedDocument<ICredential>;
  credentialDecrypted: string;
  fieldValues: Record<string, unknown>;
  context: Record<string, unknown>;
  convertedImages: { base64Data: string; mimeType: string }[];
  body: string;
  headers: Record<string, string>;
  url: string;
  method: MethodEnum;
  outputType: ApiOutputTypeEnum;
}

export enum MethodEnum {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  PATCH = "PATCH",
  DELETE = "DELETE",
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Per-provider credential resolvers
 * Mỗi provider tự resolve credential theo cách riêng.
 * ═══════════════════════════════════════════════════════════════════════════ */

/** Default: decrypt credential.value → plain API key / JSON. */
function resolveSimpleCredential(credential: HydratedDocument<ICredential>): string {
  if (!credential.value) {
    throw new Error("Credential value is empty. Please update your credential.");
  }
  const decrypted = decryptProviderSecret(credential.value);
  if (!decrypted) {
    throw new Error("Failed to decrypt credential. The stored value may be corrupted.");
  }
  return decrypted;
}

/**
 * Google Gemini credential resolver:
 * - Nếu credential có oauthClientId + oauthClientSecret + oauthRefreshToken
 *   → OAuth2 refresh → trả về JSON { accessToken, projectId, region } → route tới Vertex AI
 * - Ngược lại → decrypt value (API key hoặc JSON accessToken cũ)
 */
async function resolveGoogleGeminiCredential(
  credential: HydratedDocument<ICredential>
): Promise<string> {
  if (credential.oauthClientId && credential.oauthClientSecret && credential.oauthRefreshToken) {
    const clientId = decryptProviderSecret(credential.oauthClientId);
    const clientSecret = decryptProviderSecret(credential.oauthClientSecret);
    const refreshToken = decryptProviderSecret(credential.oauthRefreshToken);

    if (!clientId || !clientSecret || !refreshToken) {
      throw new Error(
        "Failed to decrypt Google OAuth credentials (clientId/clientSecret/refreshToken)."
      );
    }

    const accessToken = await getVertexAccessToken({ clientId, clientSecret, refreshToken });
    if (!accessToken) {
      throw new Error("Failed to obtain Vertex AI access token. Check OAuth credentials.");
    }
    return JSON.stringify({ accessToken });
  }
  return resolveSimpleCredential(credential);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Per-provider executors
 * ═══════════════════════════════════════════════════════════════════════════ */

export async function executeOpenaiKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = resolveSimpleCredential(ctx.credential);
  return CallProviderGeminiApi(ctx);
}

export async function executeClaudeKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = resolveSimpleCredential(ctx.credential);
  return CallProviderGeminiApi(ctx);
}

export async function executeGoogleGeminiKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = await resolveGoogleGeminiCredential(ctx.credential);

  const cred = ctx.credentialDecrypted.trim();
  if (cred.startsWith("{")) {
    try {
      const parsed = JSON.parse(cred);
      if (parsed.accessToken) return CallProviderGeminiVertexApi(ctx);
    } catch {
      /* fallthrough to SDK */
    }
  }
  return CallProviderGeminiApi(ctx);
}

export async function executeDeepSeekKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = resolveSimpleCredential(ctx.credential);
  return CallProviderGeminiApi(ctx);
}

export async function executeKlingKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = resolveSimpleCredential(ctx.credential);
  return CallProviderGeminiApi(ctx);
}

export async function executeSeeDanceKey(ctx: ExecuteProviderContext): Promise<unknown> {
  ctx.credentialDecrypted = resolveSimpleCredential(ctx.credential);
  return CallProviderGeminiApi(ctx);
}

/* ═══════════════════════════════════════════════════════════════════════════
 * Entry point
 * ═══════════════════════════════════════════════════════════════════════════ */

export function executeByProvider(
  aiProviderKey: AiProviderKeyEnum,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  if (!aiProviderKey) {
    return Promise.reject(new Error("aiProviderKey is required."));
  }
  if (!ctx.nodeData) {
    return Promise.reject(new Error("nodeData is required in ExecuteProviderContext."));
  }
  if (!ctx.credential) {
    return Promise.reject(new Error("credential is required in ExecuteProviderContext."));
  }

  const { nodeData, fieldValues, context } = ctx;
  const config = nodeData.config;
  if (!config) {
    return Promise.reject(
      new Error("Node config is missing. Please configure the node before executing.")
    );
  }

  const rawTemplate = config.bodyTemplate ?? "{}";
  const headers = config.headers ?? "{}";
  const rawUrl = config.endpoint ?? "";
  const method = (config.method || MethodEnum.POST) as MethodEnum;
  const outputType = (config.outputType || ApiOutputTypeEnum.IMAGE) as ApiOutputTypeEnum;

  if (!rawUrl) {
    return Promise.reject(
      new Error("Node config is missing 'endpoint'. Please set the API endpoint.")
    );
  }

  const replacedTemplate = replacePlaceholders(rawTemplate, fieldValues, context);
  const replacedHeaders = replacePlaceholders(headers, fieldValues, context);
  const url = replacePlaceholders(rawUrl, fieldValues, context);

  const body = parseBodyAfterReplace(replacedTemplate);
  const headersObj = parseBodyAfterReplace(replacedHeaders);
  const urlParsed = parseBodyAfterReplace(url) as string;

  if (!urlParsed) {
    return Promise.reject(
      new Error("API endpoint resolved to empty string after placeholder replacement.")
    );
  }

  ctx.body = body as string;
  ctx.headers = headersObj as Record<string, string>;
  ctx.url = urlParsed as string;
  ctx.method = method;
  ctx.outputType = outputType;

  switch (aiProviderKey) {
    case AiProviderKeyEnum.OPENAI_KEY:
      return executeOpenaiKey(ctx);
    case AiProviderKeyEnum.CLAUDE_KEY:
      return executeClaudeKey(ctx);
    case AiProviderKeyEnum.GOOGLE_GEMINI_KEY:
      return executeGoogleGeminiKey(ctx);
    case AiProviderKeyEnum.DEEP_SEEK_KEY:
      return executeDeepSeekKey(ctx);
    case AiProviderKeyEnum.KLING_KEY:
      return executeKlingKey(ctx);
    case AiProviderKeyEnum.SEE_DANCE_KEY:
      return executeSeeDanceKey(ctx);
    default:
      return Promise.reject(new Error(`Unsupported AI provider: ${aiProviderKey}`));
  }
}
