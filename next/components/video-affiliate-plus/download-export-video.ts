/**
 * Tải video export (nối / gen) — tuần tự, strip metadata, tên = productId.
 */
import { downloadBlobSequentially } from "../app/affiliate-video/shared/batchDownloadMedia";
import { buildMergedVideoFileBase } from "./csv-parser";
import { stripVideoMetadataInBrowser } from "./ffmpeg-browser";
import {
  getGeneratedVideoBlob,
  getMergedVideoBlob,
  getMergedVideoStorageKey,
  ProductVideoKeySource,
} from "./merged-video";

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

export type ExportDownloadKind = "merged" | "generated";

/**
 * Lấy blob → clear metadata → trigger download.
 * Trả true nếu đã kích hoạt tải xuống.
 */
export async function downloadExportVideoForItem(
  item: ProductVideoKeySource & {
    productId?: string;
    productLink?: string;
    videoUrls?: string[];
    videoDisabled?: boolean[];
  },
  opts: {
    sessionId?: string;
    kind: ExportDownloadKind;
    /** Delay giữa file (ms) sau khi click download. */
    waitMs?: number;
  }
): Promise<boolean> {
  return enqueueDownloadJob(async () => {
    let blob: Blob | null = null;

    if (opts.kind === "merged") {
      blob = await getMergedVideoBlob(item, opts.sessionId);
    } else {
      const urls = item.videoUrls || [];
      const disabled = item.videoDisabled || [];
      let slot = 0;
      for (let i = 0; i < Math.max(urls.length, 1); i++) {
        if (String(urls[i] || "").trim() && !disabled[i]) {
          slot = i;
          break;
        }
      }
      blob = await getGeneratedVideoBlob(item, opts.sessionId, slot);
    }

    if (!blob || blob.size <= 0) return false;

    let clean = blob;
    try {
      clean = await stripVideoMetadataInBrowser(blob);
    } catch {
      clean = blob;
    }

    const fileName = buildExportVideoFileName(item);
    await downloadBlobSequentially(clean, fileName, opts.waitMs ?? 700);
    return true;
  });
}

export function exportStorageKeyHint(
  item: ProductVideoKeySource,
  sessionId?: string
): string {
  return getMergedVideoStorageKey(item, sessionId) || item.id;
}
