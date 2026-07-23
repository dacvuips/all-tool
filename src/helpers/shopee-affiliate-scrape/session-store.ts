/**
 * Session Affiliate kiểu PeeCrawl cookie.json — persist disk + memory.
 * GemLogin chỉ dùng để capture; scrape HTTP đọc session này.
 */

import fs from "fs";
import path from "path";
import { CdpCookie } from "./raw-cdp";

export type AffiliateHttpSession = {
  marketHost: string;
  gemloginProfileId?: string;
  cookieHeader: string;
  cookies: CdpCookie[];
  userAgent: string;
  /** localStorage snapshot từ trang Affiliate (PeeCrawl dùng cho cloak; ta lưu để tái dùng/debug) */
  localStorage?: Record<string, string>;
  rawProxy?: string;
  debugAddr?: string;
  /** Port CDP để reconnect khi cào trong browser */
  cdpPort?: number;
  capturedAt: number;
};

const SESSION_DIR = path.join(process.cwd(), "data", "shopee-affiliate-sessions");

let session: AffiliateHttpSession | null = null;

function sessionFilePath(profileId?: string): string {
  const id = String(profileId || "default").replace(/[^\w.-]+/g, "_");
  return path.join(SESSION_DIR, `cookie-${id}.json`);
}

export function setAffiliateHttpSession(next: AffiliateHttpSession | null) {
  session = next;
  if (!next) return;
  try {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    fs.writeFileSync(sessionFilePath(next.gemloginProfileId), JSON.stringify(next, null, 2), "utf8");
  } catch {
    // ignore disk errors
  }
}

export function getAffiliateHttpSession(): AffiliateHttpSession | null {
  return session;
}

/** Load session từ disk (theo profile hoặc file mới nhất). */
export function loadAffiliateHttpSession(profileId?: string): AffiliateHttpSession | null {
  try {
    const file = sessionFilePath(profileId);
    if (profileId && fs.existsSync(file)) {
      const raw = JSON.parse(fs.readFileSync(file, "utf8"));
      if (raw?.cookieHeader) {
        session = raw as AffiliateHttpSession;
        return session;
      }
    }
    if (!fs.existsSync(SESSION_DIR)) return session;
    const files = fs
      .readdirSync(SESSION_DIR)
      .filter((f) => f.startsWith("cookie-") && f.endsWith(".json"))
      .map((f) => path.join(SESSION_DIR, f));
    if (!files.length) return session;
    files.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
    const raw = JSON.parse(fs.readFileSync(files[0], "utf8"));
    if (raw?.cookieHeader) {
      session = raw as AffiliateHttpSession;
      return session;
    }
  } catch {
    // ignore
  }
  return session;
}

export function requireAffiliateHttpSession(): AffiliateHttpSession {
  if (!session?.cookieHeader) {
    loadAffiliateHttpSession();
  }
  if (!session?.cookieHeader) {
    throw new Error(
      "Chưa có session Affiliate. Bấm «Mở Trình duyệt» (GemLogin) để capture cookie — giống PeeCrawl hybrid."
    );
  }
  return session;
}

export function clearAffiliateHttpSession(profileId?: string) {
  session = null;
  try {
    const file = sessionFilePath(profileId);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  } catch {
    // ignore
  }
}
