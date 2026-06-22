/**
 * Lưu tạm video upsample 1080p trên Redis — dùng cho luồng SSE + GET download ngắn.
 */
import crypto from "crypto";
import redis from "../../../helpers/redis";

const TTL_SEC = 300;
const KEY_PREFIX = "upsample-video:dl:";

export type UpsampleVideoTempPayload = {
  videoBytes: string;
  mimeType: string;
  customerId: string;
  fileName?: string;
};

export function createUpsampleVideoDownloadToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function saveUpsampleVideoTemp(
  token: string,
  payload: UpsampleVideoTempPayload
): Promise<void> {
  await redis.set(`${KEY_PREFIX}${token}`, JSON.stringify(payload), "EX", TTL_SEC);
}

export async function loadUpsampleVideoTemp(
  token: string,
  customerId: string
): Promise<UpsampleVideoTempPayload | null> {
  const raw = await redis.get(`${KEY_PREFIX}${token}`);
  if (!raw) return null;

  const data = JSON.parse(raw) as UpsampleVideoTempPayload;
  if (data.customerId !== customerId) return null;
  return data;
}

export async function deleteUpsampleVideoTemp(token: string): Promise<void> {
  await redis.del(`${KEY_PREFIX}${token}`);
}
