import crypto from "crypto";
import cache from "../helpers/cache";

const STATE_TTL_SEC = 10 * 60;
const SESSION_TTL_SEC = 10 * 60;

export type FacebookOAuthPageSession = {
  id: string;
  name: string;
  pictureUrl?: string;
  accessToken: string;
};

export type FacebookOAuthConnectSession = {
  customerId: string;
  pages: FacebookOAuthPageSession[];
  createdAt: number;
};

function stateKey(state: string): string {
  return `facebook-oauth:state:${state}`;
}

function sessionKey(sessionId: string): string {
  return `facebook-oauth:session:${sessionId}`;
}

export function createOAuthState(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function createConnectSessionId(): string {
  return crypto.randomBytes(24).toString("hex");
}

export async function saveOAuthState(state: string, customerId: string): Promise<void> {
  await cache.set(stateKey(state), customerId, STATE_TTL_SEC);
}

export async function consumeOAuthState(state: string): Promise<string | null> {
  const key = stateKey(state);
  const customerId = await cache.get(key);
  if (customerId) {
    await cache.del(key);
  }
  return customerId || null;
}

export async function saveConnectSession(
  sessionId: string,
  data: FacebookOAuthConnectSession
): Promise<void> {
  await cache.set(sessionKey(sessionId), JSON.stringify(data), SESSION_TTL_SEC);
}

export async function getConnectSession(
  sessionId: string
): Promise<FacebookOAuthConnectSession | null> {
  const raw = await cache.get(sessionKey(sessionId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as FacebookOAuthConnectSession;
  } catch {
    return null;
  }
}

export async function deleteConnectSession(sessionId: string): Promise<void> {
  await cache.del(sessionKey(sessionId));
}
