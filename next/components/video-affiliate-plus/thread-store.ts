/**
 * Thread store — IndexedDB per-item cho phiên (session) hiện tại.
 *
 * Mục tiêu:
 * - Là source of truth theo từng item, không phụ thuộc mảng lớn trong React.
 * - Cho phép query trang / search / patch từng item mà không đụng toàn danh sách.
 * - Duy trì aggregate stats (thread-meta) atomic để stats bar khỏi filter toàn mảng.
 */

import {
  idbBulkPutThreads,
  idbClearThreadsBySession,
  idbDeleteThread,
  idbBulkDeleteThreads,
  idbDeleteThreadMeta,
  idbGetThread,
  idbGetThreadMeta,
  idbGetThreadsBySession,
  idbPutThread,
  idbPutThreadMeta,
  ThreadMetaRecord,
  ThreadRecord,
} from "./idb";
import { AffiliatePlusItem, ThreadStatus } from "./types";
import { toPersistedMergedVideoUrl } from "./merged-video";

export const DEFAULT_SESSION_ID = "default";

/** Chuẩn hóa chuỗi để search — bỏ dấu, lowercase, gọn khoảng trắng. */
export function normalizeSearch(s: string): string {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** searchKey chung cho một item = shopName + productName sau normalize. */
export function buildSearchKey(shopName: string, productName: string): string {
  return normalizeSearch(`${shopName || ""} ${productName || ""}`);
}

function toRecord(
  sessionId: string,
  item: AffiliatePlusItem,
  opts?: { createdAt?: number }
): ThreadRecord {
  // Không persist prompt / blob:/data: — media nằm product-videos IDB (tên merged.mp4)
  const { prompt: _omitPrompt, mergedVideoUrl, ...rest } = item;
  const persistMerged = toPersistedMergedVideoUrl(mergedVideoUrl);
  const now = Date.now();
  return {
    id: String(item.id || ""),
    sessionId,
    searchKey: buildSearchKey(item.shopName || "", item.productName || ""),
    createdAt: opts?.createdAt ?? now,
    updatedAt: now,
    data: { ...rest, prompt: "", mergedVideoUrl: persistMerged } as unknown as Record<
      string,
      unknown
    >,
  };
}

function fromRecord(rec: ThreadRecord): AffiliatePlusItem {
  const data = rec.data as unknown as AffiliatePlusItem;
  return { ...data, prompt: String(data?.prompt || "") };
}

/** Thứ tự ổn định: createdAt ASC (trên → dưới = import trước → sau). */
function sortRecordsByCreatedAt(records: ThreadRecord[]): ThreadRecord[] {
  return records.slice().sort((a, b) => {
    const ca = a.createdAt ?? a.updatedAt ?? 0;
    const cb = b.createdAt ?? b.updatedAt ?? 0;
    if (ca !== cb) return ca - cb;
    return String(a.id).localeCompare(String(b.id));
  });
}

function itemBucket(item: AffiliatePlusItem): "waiting" | "uploading" | "success" | "error" {
  const status = (item.status || "waiting") as ThreadStatus;
  const hasError = Boolean(String(item.error || "").trim());
  if (status === "error" || hasError) return "error";
  if (status === "success") return "success";
  if (status === "uploading" || status === "running") return "uploading";
  if (status === "stopped" && item.pending > 0) return "waiting";
  return "waiting";
}

function computeMeta(items: AffiliatePlusItem[], sessionId: string): ThreadMetaRecord {
  let waiting = 0;
  let uploading = 0;
  let success = 0;
  let error = 0;
  for (const item of items) {
    const bucket = itemBucket(item);
    if (bucket === "error") error += 1;
    else if (bucket === "success") success += 1;
    else if (bucket === "uploading") uploading += 1;
    else waiting += 1;
  }
  return {
    sessionId,
    total: items.length,
    waiting,
    uploading,
    success,
    error,
    updatedAt: Date.now(),
  };
}

async function applyMetaDelta(
  sessionId: string,
  prev: AffiliatePlusItem | null | undefined,
  next: AffiliatePlusItem | null | undefined
): Promise<ThreadMetaRecord> {
  const meta = (await idbGetThreadMeta(sessionId)) || computeMeta([], sessionId);
  if (prev) {
    meta[itemBucket(prev)] = Math.max(0, meta[itemBucket(prev)] - 1);
    meta.total = Math.max(0, meta.total - 1);
  }
  if (next) {
    meta[itemBucket(next)] += 1;
    meta.total += 1;
  }
  meta.updatedAt = Date.now();
  await idbPutThreadMeta(meta);
  emitMetaChanged(sessionId, meta);
  return meta;
}

/**
 * Ghi toàn bộ items của một session (bulk put) và cập nhật meta.
 * Không xóa records cũ ngoài input — dùng `clearSessionThreads` trước nếu cần replace-all.
 */
export async function bulkSaveSessionThreads(
  sessionId: string,
  items: AffiliatePlusItem[]
): Promise<void> {
  if (!sessionId) return;
  const base = Date.now();
  const records = items.map((item, index) =>
    toRecord(sessionId, item, { createdAt: base + index })
  );
  await idbBulkPutThreads(records);
  await idbPutThreadMeta(computeMeta(items, sessionId));
}

/**
 * Thay thế toàn bộ threads của một session bằng list mới (dùng khi Import mới).
 */
export async function replaceSessionThreads(
  sessionId: string,
  items: AffiliatePlusItem[]
): Promise<void> {
  if (!sessionId) return;
  await idbClearThreadsBySession(sessionId);
  await bulkSaveSessionThreads(sessionId, items);
}

/** Lấy toàn bộ items của session (đã unwrap, thứ tự trên → dưới). */
export async function getSessionItems(sessionId: string): Promise<AffiliatePlusItem[]> {
  if (!sessionId) return [];
  const records = await idbGetThreadsBySession(sessionId);
  return sortRecordsByCreatedAt(records).map(fromRecord);
}

/** Patch 1 item — read → merge → put; đồng thời recompute meta nhanh. */
export async function patchThread(
  sessionId: string,
  id: string,
  patch: Partial<AffiliatePlusItem>
): Promise<AffiliatePlusItem | undefined> {
  if (!sessionId || !id) return undefined;
  const existing = await idbGetThread(id);
  if (!existing) return undefined;
  const prevItem = fromRecord(existing);
  const nextItem: AffiliatePlusItem = { ...prevItem, ...patch };
  const nextRec = toRecord(sessionId, nextItem, {
    createdAt: existing.createdAt ?? existing.updatedAt ?? Date.now(),
  });
  await idbPutThread(nextRec);
  await applyMetaDelta(sessionId, prevItem, nextItem);
  emitThreadPatch(sessionId, id, patch, nextItem);
  return nextItem;
}

/** Xóa 1 item khỏi session. */
export async function removeThread(sessionId: string, id: string): Promise<void> {
  const existing = await idbGetThread(id);
  await idbDeleteThread(id);
  if (existing) await applyMetaDelta(sessionId, fromRecord(existing), null);
  emitThreadRemoved(sessionId, [id]);
}

/** Xóa nhiều item khỏi session. */
export async function removeThreads(sessionId: string, ids: string[]): Promise<void> {
  if (!ids.length) return;
  const existing = await Promise.all(ids.map((id) => idbGetThread(id)));
  await idbBulkDeleteThreads(ids);
  for (const rec of existing) {
    if (rec) await applyMetaDelta(sessionId, fromRecord(rec), null);
  }
  emitThreadRemoved(sessionId, ids);
}

/** Xóa toàn bộ session (threads + meta). */
export async function clearSession(sessionId: string): Promise<void> {
  if (!sessionId) return;
  await idbClearThreadsBySession(sessionId);
  await idbDeleteThreadMeta(sessionId);
}

/**
 * Truy vấn 1 trang theo session, có filter search chung shopName + productName.
 * Trả về items đã sắp theo `updatedAt` desc và totalMatched.
 */
export async function queryThreadPage(
  sessionId: string,
  opts: { offset?: number; limit?: number; q?: string } = {}
): Promise<{ items: AffiliatePlusItem[]; totalMatched: number; total: number }> {
  const offset = Math.max(0, Number(opts.offset) || 0);
  const limit = Math.max(1, Number(opts.limit) || 50);
  const q = normalizeSearch(opts.q || "");

  const records = await idbGetThreadsBySession(sessionId);
  const filtered = q ? records.filter((r) => r.searchKey.includes(q)) : records;
  const sorted = sortRecordsByCreatedAt(filtered);
  const pageRecs = sorted.slice(offset, offset + limit);
  return {
    items: pageRecs.map(fromRecord),
    totalMatched: filtered.length,
    total: records.length,
  };
}

/** Lấy 1 item theo id (fresh từ IDB). */
export async function getThreadItem(
  sessionId: string,
  id: string
): Promise<AffiliatePlusItem | undefined> {
  const rec = await idbGetThread(id);
  if (!rec || rec.sessionId !== sessionId) return undefined;
  return fromRecord(rec);
}

/** Lấy meta hoặc tính lại nếu chưa có. */
export async function getSessionMeta(sessionId: string): Promise<ThreadMetaRecord> {
  const existing = await idbGetThreadMeta(sessionId);
  if (existing) return existing;
  const items = await getSessionItems(sessionId);
  const meta = computeMeta(items, sessionId);
  await idbPutThreadMeta(meta);
  return meta;
}

/** Đếm số item đang bật switch (selected) trong session. */
export async function countSelectedInSession(sessionId: string): Promise<number> {
  if (!sessionId) return 0;
  const records = await idbGetThreadsBySession(sessionId);
  return records.filter((r) => Boolean((r.data as { selected?: boolean })?.selected)).length;
}

/** Session có ít nhất 1 video đã nối (hoặc productId để tra IDB). */
export async function sessionHasMergedVideos(sessionId: string): Promise<boolean> {
  if (!sessionId) return false;
  const records = await idbGetThreadsBySession(sessionId);
  return records.some((r) => {
    const d = r.data as { mergedVideoUrl?: string; productId?: string; productLink?: string };
    return Boolean(d.mergedVideoUrl?.trim() || d.productId?.trim() || d.productLink?.trim());
  });
}

/** Recompute meta từ records hiện tại — gọi sau các thao tác bulk. */
export async function recomputeMeta(sessionId: string): Promise<ThreadMetaRecord> {
  const items = await getSessionItems(sessionId);
  const meta = computeMeta(items, sessionId);
  await idbPutThreadMeta(meta);
  emitMetaChanged(sessionId, meta);
  return meta;
}

/** ==================== EMITTER (in-memory pub/sub) ==================== */

type PatchEvent = {
  type: "patch";
  sessionId: string;
  id: string;
  patch: Partial<AffiliatePlusItem>;
  next: AffiliatePlusItem;
};

type RemovedEvent = {
  type: "removed";
  sessionId: string;
  ids: string[];
};

type MetaEvent = {
  type: "meta";
  sessionId: string;
  meta: ThreadMetaRecord;
};

export type ThreadEvent = PatchEvent | RemovedEvent | MetaEvent;

type Listener = (ev: ThreadEvent) => void;

const listeners = new Set<Listener>();

export function subscribeThreadEvents(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(ev: ThreadEvent) {
  listeners.forEach((fn) => {
    try {
      fn(ev);
    } catch (err) {
      console.warn("[thread-store] listener failed", err);
    }
  });
}

function emitThreadPatch(
  sessionId: string,
  id: string,
  patch: Partial<AffiliatePlusItem>,
  next: AffiliatePlusItem
) {
  emit({ type: "patch", sessionId, id, patch, next });
}

function emitThreadRemoved(sessionId: string, ids: string[]) {
  emit({ type: "removed", sessionId, ids });
}

function emitMetaChanged(sessionId: string, meta: ThreadMetaRecord) {
  emit({ type: "meta", sessionId, meta });
}
