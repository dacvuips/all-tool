/**
 * Lưu tạm ảnh upsample 2K/4K trên Redis — dùng cho luồng SSE + GET download ngắn.
 */
import crypto from "crypto";
import redis from "../../../helpers/redis";

const TTL_SEC = 300;
const KEY_PREFIX = "upsample-image:dl:";

export type UpsampleImageTempPayload = {
  imageBytes: string;
  mimeType: string;
  customerId: string;
  fileName?: string;
};

export function createUpsampleImageDownloadToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function saveUpsampleImageTemp(
  token: string,
  payload: UpsampleImageTempPayload
): Promise<void> {
  await redis.set(`${KEY_PREFIX}${token}`, JSON.stringify(payload), "EX", TTL_SEC);
}

export async function loadUpsampleImageTemp(
  token: string,
  customerId: string
): Promise<UpsampleImageTempPayload | null> {
  const raw = await redis.get(`${KEY_PREFIX}${token}`);
  if (!raw) return null;

  const data = JSON.parse(raw) as UpsampleImageTempPayload;
  if (data.customerId !== customerId) return null;
  return data;
}

export async function deleteUpsampleImageTemp(token: string): Promise<void> {
  await redis.del(`${KEY_PREFIX}${token}`);
}
