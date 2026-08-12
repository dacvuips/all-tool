/**
 * Tải video export (nối / gen) — từng file, lưu ngay (không zip / không gom hàng loạt).
 */
import { saveAs } from "file-saver";
import { buildMergedVideoFileBase } from "./csv-parser";
import { stripVideoMetadataInBrowser } from "./ffmpeg-browser";
import {
  getGeneratedVideoBlob,
  getMergedVideoBlob,
  getMergedVideoStorageKey,
  ProductVideoKeySource,
} from "./merged-video";

type ExportItem = ProductVideoKeySource & {
  productId?: string;
  productLink?: string;
  videoUrls?: string[];
  videoDisabled?: boolean[];
};

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: (opts?: {
    mode?: "read" | "readwrite";
    startIn?: string;
  }) => Promise<FileSystemDirectoryHandle>;
};

/** Hàng đợi tải 1 file/lần (tránh browser chặn nhiều click download). */
let _downloadChain: Promise<void> = Promise.resolve();

function enqueueDownloadJob<T>(job: () => Promise<T>): Promise<T> {
  const run = _downloadChain.then(job, job);
  _downloadChain = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Tên file: ID sản phẩm.mp4 */
export function buildExportVideoFileName(item: {
  productId?: string;
  productLink?: string;
  id?: string;
}): string {
  const base =
    String(item.productId || "").trim() ||
    buildMergedVideoFileBase(item) ||
    String(item.id || "video").slice(0, 40);
  const safe = base.replace(/[<>:"/\\|?*\x00-\x1f]/g, "_") || "video";
  return `${safe}.mp4`;
}

export type ExportDownloadKind = "merged" | "generated" | "auto";

function firstGeneratedSlot(item: ExportItem): number {
  const urls = item.videoUrls || [];
  const disabled = item.videoDisabled || [];
  for (let i = 0; i < Math.max(urls.length, 1); i++) {
    if (String(urls[i] || "").trim() && !disabled[i]) return i;
  }
  return 0;
}

/** Lấy blob video (nối / generate) + clear metadata. */
export async function resolveExportVideoBlob(
  item: ExportItem,
  opts: { sessionId?: string; kind: ExportDownloadKind }
): Promise<Blob | null> {
  let blob: Blob | null = null;

  if (opts.kind === "merged") {
    blob = await getMergedVideoBlob(item, opts.sessionId);
  } else if (opts.kind === "generated") {
    blob = await getGeneratedVideoBlob(item, opts.sessionId, firstGeneratedSlot(item));
  } else {
    blob = await getMergedVideoBlob(item, opts.sessionId);
    if (!blob || blob.size <= 0) {
      blob = await getGeneratedVideoBlob(item, opts.sessionId, firstGeneratedSlot(item));
    }
  }

  if (!blob || blob.size <= 0) return null;

  try {
    return await stripVideoMetadataInBrowser(blob);
  } catch {
    return blob;
  }
}

/** Chọn thư mục lưu — Chrome/Edge. Hủy picker → throw AbortError. */
export async function pickExportDirectory(): Promise<FileSystemDirectoryHandle | null> {
  const picker = (window as DirectoryPickerWindow).showDirectoryPicker;
  if (!picker) return null;
  return picker({ mode: "readwrite", startIn: "downloads" });
}

/** Ghi 1 file xuống đĩa ngay (thư mục đã chọn hoặc saveAs). */
export async function saveExportBlobToDisk(
  blob: Blob,
  fileName: string,
  dirHandle?: FileSystemDirectoryHandle | null
): Promise<void> {
  if (dirHandle) {
    const file = await dirHandle.getFileHandle(fileName, { create: true });
    const writable = await file.createWritable();
    try {
      await writable.write(blob);
    } finally {
      await writable.close();
    }
    return;
  }
  saveAs(blob, fileName);
  await new Promise((r) => setTimeout(r, 900));
}

/**
 * Lấy blob → clear metadata → lưu ngay 1 file (tên = productId).
 * Trả true nếu đã lưu xuống.
 */
export async function downloadExportVideoForItem(
  item: ExportItem,
  opts: {
    sessionId?: string;
    kind: ExportDownloadKind;
    /** Delay giữa file khi fallback saveAs (ms). */
    waitMs?: number;
    dirHandle?: FileSystemDirectoryHandle | null;
  }
): Promise<boolean> {
  return enqueueDownloadJob(async () => {
    const blob = await resolveExportVideoBlob(item, opts);
    if (!blob) return false;

    const fileName = buildExportVideoFileName(item);
    if (opts.dirHandle) {
      await saveExportBlobToDisk(blob, fileName, opts.dirHandle);
    } else {
      saveAs(blob, fileName);
      await new Promise((r) => setTimeout(r, opts.waitMs ?? 900));
    }
    return true;
  });
}

export function exportStorageKeyHint(
  item: ProductVideoKeySource,
  sessionId?: string
): string {
  return getMergedVideoStorageKey(item, sessionId) || item.id;
}
