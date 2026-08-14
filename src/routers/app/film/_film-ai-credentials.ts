/**
 * Film AI credentials — đọc/ghi bảng Credential (encrypt, không trả plaintext ra FE).
 * Chỉ dùng credential của customer đang đăng nhập (không fallback admin).
 */
import { credentialService } from "../../../libs/dal/credential";
import { CredentialModel } from "../../../libs/dal/credential/credential.model";
import { AiProviderKeyEnum } from "../../../libs/dal/product";
import { Context } from "../../../libs/graphql";
import { decryptProviderSecret } from "../../../packages/encryption/encrypt-provider";

export type FilmAiProvider = "gateway" | "openai" | "gemini";

export type FilmAiCredential = {
  provider: FilmAiProvider;
  apiKey: string;
  endpoint?: string;
  model?: string;
};

export type FilmAiCredentialStatus = {
  hasOpenaiKey: boolean;
  hasGeminiKey: boolean;
  hasGateway: boolean;
  hasAnyAi: boolean;
  gatewayEndpoint: string;
  gatewayModel: string;
};

export const FILM_DEFAULT_GATEWAY_MODEL = "gpt-5-5";

export function filmCustomerId(context: Context): string {
  return String(context.customerId || context.id || "").trim();
}

type GatewayPayload = {
  endpoint: string;
  apiKey: string;
  model: string;
};

function asString(v: unknown): string {
  return String(v ?? "").trim();
}

function credPlainValue(doc: any): string {
  const raw = doc?._doc?.value ?? doc?.value;
  if (!raw) return "";
  try {
    return asString(decryptProviderSecret(String(raw)));
  } catch {
    return "";
  }
}

async function loadPlainCredential(
  customerId: string,
  key: AiProviderKeyEnum
): Promise<string> {
  const customerDoc = await credentialService.findOne({
    key,
    customerId,
    isCustomerCredential: true,
    active: { $ne: false },
  });
  return credPlainValue(customerDoc);
}

function parseGatewayPayload(raw: string): GatewayPayload | null {
  const text = asString(raw);
  if (!text) return null;
  try {
    const obj = JSON.parse(text) as Record<string, unknown>;
    const endpoint = asString(obj.endpoint ?? obj.baseUrl);
    const apiKey = asString(obj.apiKey ?? obj.key ?? obj.value);
    const model = asString(obj.model) || FILM_DEFAULT_GATEWAY_MODEL;
    if (!endpoint || !apiKey) return null;
    return { endpoint, apiKey, model };
  } catch {
    return null;
  }
}

export async function getFilmAiCredentialStatus(
  customerId: string
): Promise<FilmAiCredentialStatus> {
  const [openai, gemini, gatewayRaw] = await Promise.all([
    loadPlainCredential(customerId, AiProviderKeyEnum.OPENAI_KEY),
    loadPlainCredential(customerId, AiProviderKeyEnum.GOOGLE_GEMINI_KEY),
    loadPlainCredential(customerId, AiProviderKeyEnum.CHATGPT_GATEWAY_KEY),
  ]);
  const gateway = parseGatewayPayload(gatewayRaw);
  const hasOpenaiKey = Boolean(openai);
  const hasGeminiKey = Boolean(gemini);
  const hasGateway = Boolean(gateway);
  return {
    hasOpenaiKey,
    hasGeminiKey,
    hasGateway,
    hasAnyAi: hasGateway || hasOpenaiKey || hasGeminiKey,
    gatewayEndpoint: gateway?.endpoint || "",
    gatewayModel: gateway?.model || "",
  };
}

export async function resolveFilmAiCredentialFromDb(
  customerId: string,
  preferred?: string
): Promise<FilmAiCredential> {
  const [openai, gemini, gatewayRaw] = await Promise.all([
    loadPlainCredential(customerId, AiProviderKeyEnum.OPENAI_KEY),
    loadPlainCredential(customerId, AiProviderKeyEnum.GOOGLE_GEMINI_KEY),
    loadPlainCredential(customerId, AiProviderKeyEnum.CHATGPT_GATEWAY_KEY),
  ]);
  const gateway = parseGatewayPayload(gatewayRaw);
  const pref = asString(preferred).toLowerCase();

  const tryGateway = (): FilmAiCredential => {
    if (!gateway) {
      const err: any = new Error(
        "Chưa cấu hình Gateway (Endpoint + API Key + Model) trong API Keys."
      );
      err.statusCode = 400;
      throw err;
    }
    return {
      provider: "gateway",
      apiKey: gateway.apiKey,
      endpoint: gateway.endpoint,
      model: gateway.model,
    };
  };
  const tryOpenai = (): FilmAiCredential => {
    if (!openai) {
      const err: any = new Error("Chưa cấu hình OpenAI Key trong API Keys.");
      err.statusCode = 400;
      throw err;
    }
    return { provider: "openai", apiKey: openai };
  };
  const tryGemini = (): FilmAiCredential => {
    if (!gemini) {
      const err: any = new Error("Chưa cấu hình Gemini Key trong API Keys.");
      err.statusCode = 400;
      throw err;
    }
    return { provider: "gemini", apiKey: gemini };
  };

  if (pref === "gateway" && gateway) return tryGateway();
  if (pref === "openai" && openai) return tryOpenai();
  if (pref === "gemini" && gemini) return tryGemini();

  if (gateway) return tryGateway();
  if (openai) return tryOpenai();
  if (gemini) return tryGemini();

  const err: any = new Error(
    "Chưa có API Key. Mở API Keys và lưu Gateway / OpenAI / Gemini (lưu trên server)."
  );
  err.statusCode = 400;
  throw err;
}

async function upsertCustomerCredential(params: {
  context: Context;
  key: AiProviderKeyEnum;
  value: string;
}): Promise<void> {
  const { context, key, value } = params;
  const customerId = filmCustomerId(context);
  const existing = await CredentialModel.findOne({
    key,
    customerId,
    isCustomerCredential: true,
  });
  if (existing?._id) {
    await credentialService.updateOne(String(existing._id), {
      key,
      value,
      active: true,
    });
    return;
  }
  await credentialService.create({
    key,
    value,
    active: true,
    customerId,
    isCustomerCredential: true,
    isAdminCredential: false,
  });
}

export type FilmAiCredentialSaveInput = {
  openaiKey?: string;
  geminiKey?: string;
  gatewayEndpoint?: string;
  gatewayApiKey?: string;
  gatewayModel?: string;
};

/** Chỉ ghi field có giá trị mới (không nhận **** / rỗng). */
export async function saveFilmAiCredentials(
  context: Context,
  input: FilmAiCredentialSaveInput
): Promise<FilmAiCredentialStatus> {
  const openaiKey = asString(input.openaiKey);
  const geminiKey = asString(input.geminiKey);
  const gatewayEndpoint = asString(input.gatewayEndpoint);
  const gatewayApiKey = asString(input.gatewayApiKey);
  const gatewayModel = asString(input.gatewayModel);

  if (openaiKey && openaiKey !== "****") {
    await upsertCustomerCredential({
      context,
      key: AiProviderKeyEnum.OPENAI_KEY,
      value: openaiKey,
    });
  }
  if (geminiKey && geminiKey !== "****") {
    await upsertCustomerCredential({
      context,
      key: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
      value: geminiKey,
    });
  }

  const gwAny = Boolean(gatewayEndpoint || gatewayApiKey || gatewayModel);
  if (gwAny) {
    const current = parseGatewayPayload(
      await loadPlainCredential(
        filmCustomerId(context),
        AiProviderKeyEnum.CHATGPT_GATEWAY_KEY
      )
    );
    const nextEndpoint = gatewayEndpoint || current?.endpoint || "";
    const nextKey =
      gatewayApiKey && gatewayApiKey !== "****"
        ? gatewayApiKey
        : current?.apiKey || "";
    const nextModel =
      gatewayModel || current?.model || FILM_DEFAULT_GATEWAY_MODEL;
    if (!nextEndpoint || !nextKey) {
      const err: any = new Error(
        "Gateway cần đủ Endpoint và API Key (hoặc để trống cả ba)."
      );
      err.statusCode = 400;
      throw err;
    }
    await upsertCustomerCredential({
      context,
      key: AiProviderKeyEnum.CHATGPT_GATEWAY_KEY,
      value: JSON.stringify({
        endpoint: nextEndpoint,
        apiKey: nextKey,
        model: nextModel,
      }),
    });
  }

  return getFilmAiCredentialStatus(filmCustomerId(context));
}
