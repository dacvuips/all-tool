import { Request } from "express";
import redis from "../../../helpers/redis";

export const DEFAULT_LIMIT = 5;
export const CUSTOMER_LIMIT = 15;
export const KEY_PREFIX = "guest_tryon_limit:";

export const getGuestIp = (req: Request) => {
  return (req.headers["x-forwarded-for"] as string)?.split(",")[0] || req.ip || (req.socket as any).remoteAddress;
};

export const getGuestContext = (req: Request, customerId?: string): { identifier: string; isCustomer: boolean } => {
  // 1. Check passed customerId (GraphQL context or Express body)
  if (customerId) {
    return { identifier: customerId, isCustomer: true };
  }
 console.log("customerId", customerId)

  // 3. Fallback to IP
  return { identifier: getGuestIp(req), isCustomer: false };
};

export const getGuestTryOnLimit = async (req: Request, customerId?: string) => {
  const { identifier, isCustomer } = getGuestContext(req, customerId);
  const key = `${KEY_PREFIX}${identifier}`;
  const defaultLimit = isCustomer ? CUSTOMER_LIMIT : DEFAULT_LIMIT;

  const limit = await redis.get(key);
  if (limit === null) {
    // Initialize if not exists
    await redis.set(key, defaultLimit);
    return defaultLimit;
  }

  return parseInt(limit);
};

export const decreaseGuestTryOnLimit = async (req: Request, customerId?: string) => {
  const { identifier, isCustomer } = getGuestContext(req, customerId);
  const key = `${KEY_PREFIX}${identifier}`;
  const defaultLimit = isCustomer ? CUSTOMER_LIMIT : DEFAULT_LIMIT;

  let limit = await redis.get(key);

  if (limit === null) {
    // Initialize if not exists
    await redis.set(key, defaultLimit - 1);
    return defaultLimit - 1;
  }

  const currentLimit = parseInt(limit);
  if (currentLimit > 0) {
    return await redis.decr(key);
  }

  return 0;
};

export const increaseCustomerTryOnLimit = async (customerId: string, amount: number) => {
  const key = `${KEY_PREFIX}${customerId}`;
  let limit = await redis.get(key);

  if (limit === null) {
    // Initialize if not exists with CUSTOMER_LIMIT + amount
    await redis.set(key, CUSTOMER_LIMIT + amount);
    return CUSTOMER_LIMIT + amount;
  }

  const currentLimit = parseInt(limit);
  const newLimit = currentLimit + amount;
  await redis.set(key, newLimit);
  return newLimit;
};
