/**
 * Executor gọi API theo từng AI provider.
 * Mỗi provider có function riêng, có thể tùy biến request/response sau.
 *
 * - GOOGLE_GEMINI_KEY  → @google/genai SDK (API key) hoặc Vertex AI REST (OAuth2 Bearer token)
 */

import { parseBodyAfterReplace, replacePlaceholders } from "../../helpers/flow-node-placeholder";
import { AiProviderKeyEnum, ApiOutputTypeEnum, ProductFlowNodeData } from "../../libs/dal/product";
import { CallProviderGeminiApi } from "./call-provider-api/execute-provider-gemini";
import { CallProviderGeminiVertexApi } from "./call-provider-api/execute-provider-gemini-vertex";

/** Context truyền vào từng executor theo từng AI provider */
export interface ExecuteProviderContext {
  nodeData: ProductFlowNodeData;
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

export async function executeOpenaiKey(ctx: ExecuteProviderContext): Promise<unknown> {
  return CallProviderGeminiApi(ctx);
}

export async function executeClaudeKey(ctx: ExecuteProviderContext): Promise<unknown> {
  return CallProviderGeminiApi(ctx);
}

export async function executeGoogleGeminiKey(ctx: ExecuteProviderContext): Promise<unknown> {
  const cred = ctx.credentialDecrypted?.trim();
  if (cred && cred.startsWith("{")) {
    try {
      const parsed = JSON.parse(cred);
      if (parsed.accessToken) return CallProviderGeminiVertexApi(ctx);
    } catch { /* fallthrough to SDK */ }
  }
  return CallProviderGeminiApi(ctx);
}

export async function executeDeepSeekKey(ctx: ExecuteProviderContext): Promise<unknown> {
  return CallProviderGeminiApi(ctx);
}

export async function executeKlingKey(ctx: ExecuteProviderContext): Promise<unknown> {
  return CallProviderGeminiApi(ctx);
}

export async function executeSeeDanceKey(ctx: ExecuteProviderContext): Promise<unknown> {
  return CallProviderGeminiApi(ctx);
}

export function executeByProvider(
  aiProviderKey: AiProviderKeyEnum,
  ctx: ExecuteProviderContext
): Promise<unknown> {
  const { nodeData, fieldValues, context } = ctx;
  const rawTemplate = nodeData.config?.bodyTemplate ?? "{}";
  const headers = nodeData.config?.headers ?? "{}";
  const rawUrl = nodeData.config?.endpoint ?? "";
  const method = (nodeData.config?.method || MethodEnum.POST) as MethodEnum;
  const outputType = (nodeData.config?.outputType || ApiOutputTypeEnum.IMAGE) as ApiOutputTypeEnum;

  const replacedTemplate = replacePlaceholders(rawTemplate, fieldValues, context);
  const replacedHeaders = replacePlaceholders(headers, fieldValues, context);
  const url = replacePlaceholders(rawUrl, fieldValues, context);

  const body = parseBodyAfterReplace(replacedTemplate);
  const headersObj = parseBodyAfterReplace(replacedHeaders);
  const urlParsed = parseBodyAfterReplace(url) as string;

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
