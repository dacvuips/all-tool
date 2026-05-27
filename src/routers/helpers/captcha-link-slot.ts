import crypto from "crypto";
import logger from "../../helpers/logger";
import redis from "../../helpers/redis";
import type { ApiLinkData } from "./validateApiKey";

/** Thời gian giữ slot mỗi link sau khi bắt đầu gọi captcha API (ms). */
export const TIME = 10_000;

/** Thời gian block link khi không có tài khoản online (ms). */
export const CAPTCHA_LINK_BAN_TIME_MS = 30 * 60 * 1000;

const SLOT_PREFIX = "aisandbox:captcha_link_slot:";
const BAN_PREFIX = "aisandbox:captcha_link_ban:";

/** Khoảng chờ giữa các vòng quay link khi tất cả slot đang bận. */
const ALL_BUSY_POLL_MS = 500;

/** Tối đa chờ slot trống trước khi báo quá tải. */
const MAX_WAIT_FOR_SLOT_MS = 120_000;

/** Số slot mặc định nếu link không khai báo `slotNumber`. */
const DEFAULT_SLOT_NUMBER = 1;

function linkId(link: ApiLinkData): string {
  return crypto.createHash("sha256").update(`${link.url}|${link.apiKey || ""}`).digest("hex").slice(0, 16);
}

export function captchaLinkSlotKey(link: ApiLinkData): string {
  return `${SLOT_PREFIX}${linkId(link)}`;
}

export function captchaLinkBanKey(link: ApiLinkData): string {
  return `${BAN_PREFIX}${linkId(link)}`;
}

export async function isCaptchaLinkBanned(link: ApiLinkData): Promise<boolean> {
  try {
    return (await redis.exists(captchaLinkBanKey(link))) === 1;
  } catch (err: any) {
    logger.error(`[CaptchaLinkSlot] isCaptchaLinkBanned lỗi: ${err?.message}`);
    return false;
  }
}

/** Block link (không có tài khoản online) và reset counter slot về 0. */
export async function banCaptchaLink(link: ApiLinkData): Promise<void> {
  try {
    const banKey = captchaLinkBanKey(link);
    const slotKey = captchaLinkSlotKey(link);
    await redis.set(banKey, "1", "PX", CAPTCHA_LINK_BAN_TIME_MS);
    await redis.del(slotKey);
  } catch (err: any) {
    logger.error(`[CaptchaLinkSlot] banCaptchaLink lỗi: ${err?.message}`);
  }
}

/**
 * Giải phóng 1 slot (DECR).
 * Dùng khi gọi API thất bại hoặc hoàn thành sớm hơn TTL.
 * Không để counter xuống dưới 0.
 */
export async function releaseCaptchaLinkSlot(link: ApiLinkData): Promise<void> {
  try {
    const slotKey = captchaLinkSlotKey(link);
    // Lua: DECR nhưng không để < 0
    const lua = `
      local v = redis.call('GET', KEYS[1])
      if not v then return 0 end
      local n = tonumber(v)
      if n and n > 0 then
        return redis.call('DECR', KEYS[1])
      end
      return 0
    `;
    await (redis as any).eval(lua, 1, slotKey);
  } catch (err: any) {
    logger.error(`[CaptchaLinkSlot] releaseCaptchaLinkSlot lỗi: ${err?.message}`);
  }
}

/**
 * Atomically: bỏ qua nếu link bị ban hoặc counter đã đạt slotNumber;
 * nếu còn slot thì INCR counter + set TTL (gia hạn mỗi lần acquire).
 * Trả true khi chiếm được slot.
 *
 * Cơ chế:
 *   - Counter = số request đang dùng link.
 *   - TTL = TIME ms, reset mỗi lần có request mới để tự dọn khi process crash.
 *   - Khi xong, gọi releaseCaptchaLinkSlot() để DECR ngay thay vì chờ TTL.
 */
export async function tryAcquireCaptchaLinkSlot(link: ApiLinkData): Promise<boolean> {
  try {
    const maxSlots = link.slotNumber && link.slotNumber > 0 ? link.slotNumber : DEFAULT_SLOT_NUMBER;
    // Lua script:
    //   1. Nếu link bị ban → return 0
    //   2. Lấy counter hiện tại; nếu >= maxSlots → return 0 (hết slot)
    //   3. INCR counter; set TTL để tự cleanup khi process crash
    const lua = `
      local banKey  = KEYS[1]
      local slotKey = KEYS[2]
      local maxSlots = tonumber(ARGV[1])
      local ttl      = tonumber(ARGV[2])
      if redis.call('EXISTS', banKey) == 1 then
        return 0
      end
      local current = tonumber(redis.call('GET', slotKey) or '0')
      if current >= maxSlots then
        return 0
      end
      local newVal = redis.call('INCR', slotKey)
      redis.call('PEXPIRE', slotKey, ttl)
      return 1
    `;
    const result = await (redis as any).eval(
      lua,
      2,
      captchaLinkBanKey(link),
      captchaLinkSlotKey(link),
      String(maxSlots),
      String(TIME)
    );
    return Number(result) === 1;
  } catch (err: any) {
    logger.error(`[CaptchaLinkSlot] tryAcquireCaptchaLinkSlot lỗi: ${err?.message}`);
    return false;
  }
}

/**
 * Quay vòng các link cho đến khi chiếm được slot trống (hoặc hết thời gian chờ).
 * Mỗi link có `slotNumber` slot đồng thời; mặc định là 1 nếu không khai báo.
 * Trả link đã acquire; throw nếu không có link khả dụng.
 */
export async function acquireCaptchaLinkWithSlot(
  links: ApiLinkData[],
  logPrefix: string
): Promise<ApiLinkData> {
  const validLinks = links.filter((l) => l?.url);
  if (validLinks.length === 0) {
    const err: any = new Error("Chưa cấu hình API");
    err.statusCode = 500;
    throw err;
  }

  const startedAt = Date.now();

  while (Date.now() - startedAt < MAX_WAIT_FOR_SLOT_MS) {
    for (const link of validLinks) {
      if (await isCaptchaLinkBanned(link)) {
        continue;
      }
      const acquired = await tryAcquireCaptchaLinkSlot(link);
      if (acquired) {
        return link;
      }
    }

    logger.info(
      `[${logPrefix}] Tất cả link captcha đang bận hoặc bị ban. Chờ ${ALL_BUSY_POLL_MS}ms rồi thử lại...`
    );
    await new Promise((resolve) => setTimeout(resolve, ALL_BUSY_POLL_MS));
  }

  const err: any = new Error(
    "Hệ thống hiện tại đang quá tải. Vui lòng thử lại sau ít phút."
  );
  err.statusCode = 502;
  throw err;
}
