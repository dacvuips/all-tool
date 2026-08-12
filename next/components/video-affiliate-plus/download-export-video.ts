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

async function withTimeout<T>(job: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      job,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} quá ${Math.round(ms / 1000)}s`)), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
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

/** Lấy blob video (nối / generate). Tải hàng loạt: không strip ffmpeg (dễ treo sau ~100 file). */
export async function resolveExportVideoBlob(
  item: ExportItem,
  opts: { sessionId?: string; kind: ExportDownloadKind; stripMetadata?: boolean }
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

  if (opts.stripMetadata === false) return blob;

  try {
    return await withTimeout(stripVideoMetadataInBrowser(blob), 20000, "Xóa metadata");
  } catch (err) {
    console.warn("[resolveExportVideoBlob] strip skip", err);
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
    const dir = dirHandle as FileSystemDirectoryHandle & {
      queryPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
      requestPermission?: (opts: { mode: "readwrite" }) => Promise<PermissionState>;
    };
    if (dir.queryPermission && dir.requestPermission) {
      const perm = await dir.queryPermission({ mode: "readwrite" });
      if (perm !== "granted") {
        const next = await dir.requestPermission({ mode: "readwrite" });
        if (next !== "granted") {
          throw new Error("Chưa cấp quyền ghi thư mục");
        }
      }
    }
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
    stripMetadata?: boolean;
    /** Tải hàng loạt: không vào queue chung + timeout từng file. */
    bulk?: boolean;
    timeoutMs?: number;
  }
): Promise<boolean> {
  const run = async () => {
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
  };

  const timeoutMs = opts.timeoutMs ?? (opts.bulk ? 45000 : 90000);
  const bounded = () => withTimeout(run(), timeoutMs, "Tải video");

  if (opts.bulk) return bounded();
  return enqueueDownloadJob(bounded);
}

export function exportStorageKeyHint(
  item: ProductVideoKeySource,
  sessionId?: string
): string {
  return getMergedVideoStorageKey(item, sessionId) || item.id;
}
