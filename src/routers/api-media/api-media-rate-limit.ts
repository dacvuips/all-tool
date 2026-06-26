/**
 * Rate limit API Media theo IP và token (Redis sliding window ~1 phút).
 */
import { Request } from "express";
import requestIp from "request-ip";
import redis from "../../helpers/redis";

const WINDOW_SEC = 60;
const IP_MAX_PER_MIN = 60;
const TOKEN_MAX_PER_MIN = 120;

async function incrementWindow(key: string, max: number, label: string): Promise<void> {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  if (count > max) {
    const err: any = new Error(
      `Vượt giới hạn request (${label}: ${max}/phút). Vui lòng thử lại sau.`
    );
    err.statusCode = 429;
    throw err;
  }
}

export async function assertApiMediaRateLimit(req: Request, apiMediaTokenId: string): Promise<void> {
  const ip = requestIp.getClientIp(req) || "unknown";
  await incrementWindow(`api-media:rl:ip:${ip}`, IP_MAX_PER_MIN, "IP");
  await incrementWindow(`api-media:rl:token:${apiMediaTokenId}`, TOKEN_MAX_PER_MIN, "token");
}
