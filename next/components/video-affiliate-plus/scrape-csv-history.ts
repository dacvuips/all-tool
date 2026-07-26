/**
 * Phiên CSV scrape (GPM Login CDP) — store riêng trong DB video-affiliate-manager.
 */

import {
  idbClearScrapeCsvSessions,
  idbDeleteScrapeCsvSession,
  idbGetScrapeCsvSessions,
  idbPutScrapeCsvSession,
  ScrapeCsvSessionRecord,
} from "./idb";

export type ScrapeCsvSession = ScrapeCsvSessionRecord;

export async function listScrapeCsvSessions(): Promise<ScrapeCsvSession[]> {
  const list = await idbGetScrapeCsvSessions();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveScrapeCsvSession(
  input: Omit<ScrapeCsvSession, "id" | "createdAt"> & { id?: string; createdAt?: number }
): Promise<ScrapeCsvSession> {
  const session: ScrapeCsvSession = {
    id: input.id || `scrape-csv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: input.createdAt || Date.now(),
    name: String(input.name || "").trim() || undefined,
    keyword: input.keyword || "",
    marketHost: input.marketHost || "",
    marketCode: input.marketCode || "",
    productCount: Number(input.productCount) || 0,
    csv: String(input.csv || ""),
    durationMs: Math.max(0, Number(input.durationMs) || 0),
  };
  await idbPutScrapeCsvSession(session);
  return session;
}

export async function deleteScrapeCsvSession(id: string): Promise<void> {
  await idbDeleteScrapeCsvSession(id);
}

export async function clearScrapeCsvSessions(): Promise<void> {
  await idbClearScrapeCsvSessions();
}

export function formatDuration(ms: number): string {
  if (!ms || ms < 0) return "—";
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s}s`;
}

export function formatSessionTime(ts: number): string {
  try {
    return new Date(ts).toLocaleString("vi-VN");
  } catch {
    return String(ts);
  }
}

/** Hiển thị tên session — ưu tiên name, fallback keyword. */
export function sessionDisplayName(session: Pick<ScrapeCsvSession, "name" | "keyword">): string {
  const name = String(session.name || "").trim();
  if (name) return name;
  const keyword = String(session.keyword || "").trim();
  return keyword || "—";
}

/** Tên mặc định tiếp theo: Crawl Project 1, 2, … */
export function nextCrawlProjectName(sessions: Pick<ScrapeCsvSession, "name">[]): string {
  let max = 0;
  for (const s of sessions) {
    const m = String(s.name || "")
      .trim()
      .match(/^Crawl Project\s+(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `Crawl Project ${max + 1}`;
}
