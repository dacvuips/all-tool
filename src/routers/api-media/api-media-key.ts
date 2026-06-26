/**
 * Sinh / hash API Media key — không lưu plaintext trong DB (trừ legacy migrate).
 */
import crypto from "crypto";
import config from "config";
import { Request } from "express";
import { apiMediaTokenService } from "../../libs/dal/apiMediaToken";
import { IApiMediaToken } from "../../libs/dal/apiMediaToken/apiMediaToken.interface";

export const API_MEDIA_KEY_PREFIX = "f2api_";

function getKeyPepper(): string {
  return config.get<string>("secret");
}

export function hashApiMediaKey(plainKey: string): string {
  return crypto.createHmac("sha256", getKeyPepper()).update(plainKey.trim()).digest("hex");
}

export function buildApiMediaKeyPrefix(plainKey: string): string {
  const trimmed = plainKey.trim();
  if (trimmed.length <= 16) return `${trimmed}...`;
  return `${trimmed.slice(0, 12)}...${trimmed.slice(-4)}`;
}

export function generateApiMediaKeyPair(): {
  plainKey: string;
  keyHash: string;
  keyPrefix: string;
} {
  const random = crypto.randomBytes(32).toString("base64url");
  const plainKey = `${API_MEDIA_KEY_PREFIX}${random}`;
  return {
    plainKey,
    keyHash: hashApiMediaKey(plainKey),
    keyPrefix: buildApiMediaKeyPrefix(plainKey),
  };
}

function assertTokenUsable(token: IApiMediaToken): void {
  if (!token.active) {
    const err: any = new Error("API Key đã bị vô hiệu hóa");
    err.statusCode = 403;
    throw err;
  }
  if (token.expiredDate && new Date(token.expiredDate) < new Date()) {
    const err: any = new Error("API Key đã hết hạn");
    err.statusCode = 403;
    throw err;
  }
  if (
    token.requestQuantity != null &&
    token.requestQuantity >= 0 &&
    token.usedQuantity != null &&
    token.usedQuantity >= token.requestQuantity
  ) {
    const err: any = new Error("Đã hết lượt sử dụng. Vui lòng nâng cấp gói.");
    err.statusCode = 429;
    throw err;
  }
}

async function migrateLegacyPlainKey(token: IApiMediaToken, plainKey: string): Promise<void> {
  if ((token as any).keyHash) return;
  await apiMediaTokenService.updateOne(token._id, {
    keyHash: hashApiMediaKey(plainKey),
    keyPrefix: buildApiMediaKeyPrefix(plainKey),
    key: null,
  });
  (token as any).keyHash = hashApiMediaKey(plainKey);
  (token as any).keyPrefix = buildApiMediaKeyPrefix(plainKey);
  delete (token as any).key;
}

/** Resolve token từ x-api-key (hash lookup + legacy plaintext migrate). */
export async function resolveApiMediaTokenFromRequest(req: Request): Promise<IApiMediaToken> {
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (!apiKey?.trim()) {
    const err: any = new Error("Thiếu x-api-key");
    err.statusCode = 400;
    throw err;
  }

  const trimmed = apiKey.trim();
  const keyHash = hashApiMediaKey(trimmed);

  let token = await apiMediaTokenService.findOne({ keyHash, active: true });
  if (!token) {
    token = await apiMediaTokenService.findOne({ key: trimmed, active: true });
    if (token) {
      await migrateLegacyPlainKey(token, trimmed);
    }
  }

  if (!token) {
    const err: any = new Error("API Key không hợp lệ");
    err.statusCode = 401;
    throw err;
  }

  assertTokenUsable(token);
  return token;
}

export async function createApiMediaTokenCredentials(
  data: Omit<Partial<IApiMediaToken>, "key" | "keyHash" | "keyPrefix"> & {
    /** Admin có thể truyền key tùy chỉnh; mặc định auto-generate */
    plainKey?: string;
  }
): Promise<{ plainKey: string; doc: IApiMediaToken }> {
  const { plainKey: customPlain, ...rest } = data;
  const { plainKey, keyHash, keyPrefix } = customPlain
    ? {
        plainKey: customPlain.trim(),
        keyHash: hashApiMediaKey(customPlain),
        keyPrefix: buildApiMediaKeyPrefix(customPlain),
      }
    : generateApiMediaKeyPair();

  const doc = await apiMediaTokenService.create({
    ...rest,
    keyHash,
    keyPrefix,
  } as any);

  return { plainKey, doc };
}
