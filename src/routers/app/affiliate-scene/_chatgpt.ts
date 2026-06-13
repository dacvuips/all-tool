import { credentialService } from "../../../libs/dal/credential";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import { decryptProviderSecret } from "../../../packages/encryption/encrypt-provider";
import { retryAICall } from "./_ai-retry";
import { getAiSceneMoreSetting } from "./_ai-scene";
import {
  AffiliateVideoOpenAIJsonSchema,
  CHATGPT_GATEWAY_SYSTEM_MESSAGE,
  CHATGPT_JSON_SCHEMA_NAME,
  ChatGPTGatewayImage,
  ChatGPTGatewayVideo,
  DEFAULT_CHATGPT_GATEWAY_BASE_URL,
  DEFAULT_CHATGPT_MODEL,
} from "./_chatgpt.constants";

export { AffiliateVideoOpenAIJsonSchema };
export type { ChatGPTGatewayImage, ChatGPTGatewayVideo };

function normalizeGatewayBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, "");
}

/** Lấy ChatGPT gateway endpoint từ setting `ai-scene-more`. */
export async function getChatGPTGatewayBaseUrl(): Promise<string> {
  try {
    const endpoint = (await getAiSceneMoreSetting())?.chatgptEndpoint?.trim();
    if (endpoint) return normalizeGatewayBaseUrl(endpoint);
  } catch {
    // fallback bên dưới
  }

  const envUrl = process.env.CHATGPT_GATEWAY_BASE_URL?.trim();
  if (envUrl) return normalizeGatewayBaseUrl(envUrl);

  return normalizeGatewayBaseUrl(DEFAULT_CHATGPT_GATEWAY_BASE_URL);
}

function extractMessageContentFromChoice(choice: unknown): string {
  if (!choice || typeof choice !== "object") return "";
  const c = choice as {
    message?: { content?: string | Array<{ type?: string; text?: string }> | null };
    text?: string;
    delta?: { content?: string | null };
  };
  if (typeof c.text === "string" && c.text.trim()) return c.text.trim();
  const delta = c.delta?.content;
  if (typeof delta === "string" && delta.trim()) return delta.trim();
  const content = c.message?.content;
  if (typeof content === "string" && content.trim()) return content.trim();
  if (Array.isArray(content)) {
    return content
      .filter((part) => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string)
      .join("")
      .trim();
  }
  return "";
}

function parseChatGPTGatewayBody(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    const err: any = new Error("AI không trả kết quả");
    err.statusCode = 502;
    throw err;
  }

  if (trimmed.startsWith("data:")) {
    const chunks: string[] = [];
    for (const line of trimmed.split("\n")) {
      const lineTrimmed = line.trim();
      if (!lineTrimmed.startsWith("data:")) continue;
      const payload = lineTrimmed.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: Array<unknown>;
        };
        const message = extractMessageContentFromChoice(parsed.choices?.[0]);
        if (message) {
          if (message.startsWith("{") || message.startsWith("[")) return message;
          chunks.push(message);
        }
      } catch {
        // bỏ qua dòng SSE không hợp lệ
      }
    }
    const combined = chunks.join("").trim();
    if (combined) return combined;
    const err: any = new Error("AI không trả kết quả (SSE)");
    err.statusCode = 502;
    throw err;
  }

  try {
    const data = JSON.parse(trimmed) as {
      choices?: Array<unknown>;
      scenes?: unknown;
      topicTitle?: unknown;
    };
    if (data.scenes || data.topicTitle) return trimmed;
    const text = extractMessageContentFromChoice(data.choices?.[0]);
    if (text) return text;
  } catch {
    // không phải JSON envelope
  }

  if (trimmed.startsWith("{") || trimmed.startsWith("[") || trimmed.includes("```")) {
    return trimmed;
  }

  const err: any = new Error("AI trả kết quả không đúng định dạng");
  err.statusCode = 502;
  throw err;
}

/** Gọi ChatGPT qua OpenAI-compatible agent-gateway (hỗ trợ vision/video + JSON). */
export async function callChatGPTGateway(params: {
  text: string;
  images?: ChatGPTGatewayImage[];
  videos?: ChatGPTGatewayVideo[];
  label: string;
  jsonSchema?: Record<string, unknown>;
  jsonSchemaName?: string;
  temperature?: number;
  /** Tên model AI OpenAI (ví dụ `"gpt-4o"`). */
  model?: string;
}): Promise<string> {
  const content: Array<Record<string, unknown>> = [];

  for (const video of params.videos ?? []) {
    content.push({
      type: "video_url",
      video_url: {
        url: `data:${video.mimeType};base64,${video.imageBytes}`,
      },
    });
  }
  for (const image of params.images ?? []) {
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${image.mimeType};base64,${image.imageBytes}`,
      },
    });
  }
  content.push({ type: "text", text: params.text });

  const [baseUrl, apiKey] = await Promise.all([getChatGPTGatewayBaseUrl(), getAdminOpenAIKey()]);
  const schemaName = params.jsonSchemaName ?? CHATGPT_JSON_SCHEMA_NAME;
  const model = params.model?.trim() || DEFAULT_CHATGPT_MODEL;

  return retryAICall(async () => {
    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: CHATGPT_GATEWAY_SYSTEM_MESSAGE },
          { role: "user", content },
        ],
        ...(params.temperature != null ? { temperature: params.temperature } : {}),
        response_format: params.jsonSchema
          ? {
              type: "json_schema",
              json_schema: {
                name: schemaName,
                strict: false,
                schema: params.jsonSchema,
              },
            }
          : { type: "json_object" },
        stream: false,
      }),
    });

    const rawBody = await resp.text();
    if (!resp.ok) {
      const err: any = new Error(`ChatGPT API error (${resp.status}): ${rawBody}`);
      err.statusCode = resp.status;
      throw err;
    }

    return parseChatGPTGatewayBody(rawBody);
  }, params.label);
}

/** Lấy OpenAI API Key admin (credential), giải mã và trả về. */
export async function getAdminOpenAIKey(): Promise<string> {
  const credentialDoc = (await credentialService.findOne({
    key: AiProviderKeyEnum.OPENAI_KEY,
    isAdminCredential: true,
  })) as any;
  const credential = credentialDoc?._doc;
  if (!credential?.value) {
    const err: any = new Error("Chưa cấu hình OpenAI API Key");
    err.statusCode = 403;
    throw err;
  }
  return decryptProviderSecret(credential.value);
}
