/**
 * Phiên CSV Mapping Account — store riêng trong DB video-affiliate-manager.
 */

import {
  idbClearMappingCsvSessions,
  idbDeleteMappingCsvSession,
  idbGetMappingCsvSessions,
  idbPutMappingCsvSession,
  MappingCsvSessionRecord,
} from "./idb";

export type MappingCsvSession = MappingCsvSessionRecord;

export async function listMappingCsvSessions(): Promise<MappingCsvSession[]> {
  const list = await idbGetMappingCsvSessions();
  return list.sort((a, b) => b.createdAt - a.createdAt);
}

export async function saveMappingCsvSession(
  input: Omit<MappingCsvSession, "id" | "createdAt"> & { id?: string; createdAt?: number }
): Promise<MappingCsvSession> {
  const session: MappingCsvSession = {
    id: input.id || `mapping-csv-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    createdAt: input.createdAt || Date.now(),
    name: String(input.name || "").trim() || "Mapping CSV",
    sourceKind: input.sourceKind === "gio-video" ? "gio-video" : "crawl-project",
    sourceSessionId: String(input.sourceSessionId || ""),
    sourceSessionName: String(input.sourceSessionName || ""),
    marketHost: String(input.marketHost || ""),
    accountCount: Math.max(0, Number(input.accountCount) || 0),
    rowCount: Math.max(0, Number(input.rowCount) || 0),
    productCount: Math.max(0, Number(input.productCount) || 0),
    skippedProducts: Math.max(0, Number(input.skippedProducts) || 0),
    csv: String(input.csv || ""),
  };
  await idbPutMappingCsvSession(session);
  return session;
}

export async function deleteMappingCsvSession(id: string): Promise<void> {
  await idbDeleteMappingCsvSession(id);
}

export async function clearMappingCsvSessions(): Promise<void> {
  await idbClearMappingCsvSessions();
}

export function nextMappingCsvName(sessions: Pick<MappingCsvSession, "name">[]): string {
  let max = 0;
  for (const s of sessions) {
    const m = String(s.name || "")
      .trim()
      .match(/^Mapping\s+(\d+)$/i);
    if (m) max = Math.max(max, Number(m[1]) || 0);
  }
  return `Mapping ${max + 1}`;
}
