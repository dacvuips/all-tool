/**
 * Rate limit API Media theo IP và token (Redis fixed window ~1 phút).
 *
 * IP: tối đa 200 request/phút; vượt ngưỡng → khóa IP 5 phút (tự nhả qua Redis TTL).
 * Token: tối đa 120 request/phút (chỉ chặn tạm trong cửa sổ 1 phút).
 */
import { Request } from "express";
import requestIp from "request-ip";
import redis from "../../helpers/redis";

const WINDOW_SEC = 60;
const IP_MAX_PER_MIN = 200;
const IP_LOCK_SEC = 5 * 60;
const TOKEN_MAX_PER_MIN = 120;

const IP_LOCK_KEY_PREFIX = "api-media:rl:ip-lock:";
const IP_COUNT_KEY_PREFIX = "api-media:rl:ip:";

function rateLimitError(message: string): never {
  const err: any = new Error(message);
  err.statusCode = 429;
  throw err;
}

async function incrementWindow(key: string, max: number, label: string): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  if (count > max) {
    rateLimitError(`Vượt giới hạn request (${label}: ${max}/phút). Vui lòng thử lại sau.`);
  }
}

async function assertIpRateLimit(ip: string): Promise<void> {
  const lockKey = `${IP_LOCK_KEY_PREFIX}${ip}`;
  const locked = await redis.get(lockKey);
  if (locked) {
    rateLimitError(
      `IP tạm khóa do vượt giới hạn (${IP_MAX_PER_MIN}/phút). Vui lòng thử lại sau 5 phút.`
    );
  }

  const countKey = `${IP_COUNT_KEY_PREFIX}${ip}`;
  const count = await redis.incr(countKey);
  if (count === 1) {
    await redis.expire(countKey, WINDOW_SEC);
  }
  if (count > IP_MAX_PER_MIN) {
    await redis.set(lockKey, "1", "EX", IP_LOCK_SEC);
    rateLimitError(
      `IP tạm khóa do vượt giới hạn (${IP_MAX_PER_MIN}/phút). Vui lòng thử lại sau 5 phút.`
    );
  }
}

export async function assertApiMediaRateLimit(req: Request, apiMediaTokenId: string): Promise<void> {
  const ip = requestIp.getClientIp(req) || "unknown";
  await assertIpRateLimit(ip);
  await incrementWindow(`api-media:rl:token:${apiMediaTokenId}`, TOKEN_MAX_PER_MIN, "token");
}
