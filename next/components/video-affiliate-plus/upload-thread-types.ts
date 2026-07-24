/**
 * Kiểu dữ liệu & helper cho tab Đăng video Shope (Quản lý luồng upload).
 * Mỗi dòng video = 1 task; gộp theo username = 1 "luồng" account (giống tool MLS).
 */
import { hydrateMergedVideoUrls } from "./merged-video";
import { createEmptyItem } from "./types";
import { PersistedUploadThread } from "./upload-history";

/** Trạng thái 1 video/task trong luồng upload */
export type UploadStatus = "stopped" | "running" | "success" | "error";

/** Giới hạn video gắn / account khi Tạo Luồng từ phiên Generate */
export const MAX_UPLOAD_ITEMS = 90;

export const COUNTRY_OPTIONS = [
  { value: "VN", label: "VN - Việt Nam" },
  { value: "TH", label: "TH - Thái Lan" },
  { value: "ID", label: "ID - Indonesia" },
  { value: "MY", label: "MY - Malaysia" },
  { value: "PH", label: "PH - Philippines" },
  { value: "SG", label: "SG - Singapore" },
];

/**
 * 1 hàng video trong bảng (tương đương video_tasks ở tool MLS).
 * `nextRunAt`: unix giây — thời điểm được phép upload tiếp theo (delay ngẫu nhiên).
 */
export type ShopeeVideoUploadThread = {
  id: string;
  selected: boolean;
  username: string;
  cookie: string;
  country: string;
  caption: string;
  productLink: string;
  productId: string;
  generateItemId: string;
  videoFile: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  proxy: string;
  error: string;
  status: UploadStatus;
  /** Thời điểm chạy tiếp (unix giây). 0 = sẵn sàng ngay. */
  nextRunAt?: number;
};

/** Nhóm theo account — 1 luồng account gồm nhiều video task */
export type AccountGroup = {
  key: string;
  username: string;
  cookie: string;
  proxy: string;
  country: string;
  delayMin: number;
  delayMax: number;
  videos: ShopeeVideoUploadThread[];
};

/** Kết quả Check 24h (cache UI — API thật gắn sau) */
export type Check24hResult = {
  count?: number;
  canPost?: boolean;
  banned?: boolean;
  error?: string;
  success: boolean;
};

/**
 * Rải đều `videoCount` video cho `accountCount` account.
 * Mỗi account nhận số gần bằng nhau (lệch tối đa 1), không vượt `cap`.
 */
export function computeEvenPerAccountCounts(
  videoCount: number,
  accountCount: number,
  cap: number
): number[] {
  const counts = Array.from({ length: Math.max(0, accountCount) }, () => 0);
  if (accountCount <= 0 || videoCount <= 0 || cap <= 0) return counts;

  const toAssign = Math.min(videoCount, accountCount * cap);
  const base = Math.floor(toAssign / accountCount);
  let rem = toAssign % accountCount;

  for (let i = 0; i < accountCount; i++) {
    const n = base + (rem > 0 ? 1 : 0);
    counts[i] = Math.min(cap, n);
    if (rem > 0) rem--;
  }
  return counts;
}

export function makeThread(
  index: number,
  params: Partial<ShopeeVideoUploadThread>
): ShopeeVideoUploadThread {
  return {
    id: crypto.randomUUID(),
    selected: true,
    username: params.username || `ACC${String(index + 1).padStart(3, "0")}`,
    cookie: params.cookie || "",
    country: params.country || "VN",
    caption: params.caption || "",
    productLink: params.productLink || "",
    productId: params.productId || "",
    generateItemId: params.generateItemId || "",
    videoFile: params.videoFile || "",
    uploaded: params.uploaded ?? 0,
    pending: params.pending ?? 1,
    delayMin: params.delayMin ?? 180,
    delayMax: params.delayMax ?? 240,
    proxy: params.proxy || "",
    error: params.error || "-",
    status: params.status || "stopped",
    nextRunAt: params.nextRunAt ?? 0,
  };
}

export function statusLabel(status: UploadStatus): string {
  if (status === "running") return "Đang chạy";
  if (status === "success") return "Xong";
  if (status === "error") return "Lỗi";
  return "Dừng";
}

/** Gộp trạng thái nhiều video → trạng thái account */
export function aggregateStatus(videos: ShopeeVideoUploadThread[]): UploadStatus {
  if (!videos.length) return "stopped";
  if (videos.some((v) => v.status === "running")) return "running";
  if (videos.some((v) => v.status === "error")) return "error";
  if (videos.every((v) => v.status === "success")) return "success";
  return "stopped";
}

/** Gộp danh sách flat → nhóm theo username */
export function groupThreadsByAccount(threads: ShopeeVideoUploadThread[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();
  for (const item of threads) {
    const key = item.username || item.id;
    const existing = map.get(key);
    if (existing) {
      existing.videos.push(item);
    } else {
      map.set(key, {
        key,
        username: item.username,
        cookie: item.cookie,
        proxy: item.proxy,
        country: item.country,
        delayMin: item.delayMin,
        delayMax: item.delayMax,
        videos: [item],
      });
    }
  }
  return Array.from(map.values());
}

/** Khôi phục blob URL từ IndexedDB cho preview video nối */
export async function hydrateUploadThreads(
  list: PersistedUploadThread[]
): Promise<ShopeeVideoUploadThread[]> {
  if (!list.length) return [];
  const pseudoItems = list.map((row) =>
    createEmptyItem({
      id: row.generateItemId || row.id,
      productId: row.productId || "",
      productName: row.caption || "",
      productLink: row.productLink || "",
      prompt: row.caption || "",
      mergedVideoUrl: row.videoFile || "",
    })
  );
  const hydrated = await hydrateMergedVideoUrls(pseudoItems);
  return list.map((row, index) => {
    const merged =
      String(hydrated[index]?.mergedVideoUrl || "").trim() || String(row.videoFile || "").trim();
    return {
      ...row,
      videoFile: merged,
      // Khi restore: không giữ "running" (tránh auto-upload khi mở lại trang)
      status: row.status === "running" ? "stopped" : row.status,
      nextRunAt: 0,
    };
  });
}

/** Random delay trong [min, max] giây */
export function randomDelaySeconds(min: number, max: number): number {
  const a = Math.max(0, Math.round(min) || 0);
  const b = Math.max(a, Math.round(max) || a);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Format countdown còn lại (giây) → "12s" | "Sẵn sàng" */
export function formatCountdown(nextRunAt: number, nowSec: number): string {
  const remaining = Math.max(0, Math.floor(nextRunAt) - nowSec);
  if (remaining <= 0) return "Sẵn sàng";
  if (remaining >= 3600) {
    const h = Math.floor(remaining / 3600);
    const m = Math.floor((remaining % 3600) / 60);
    return `${h}h${m}m`;
  }
  if (remaining >= 60) {
    const m = Math.floor(remaining / 60);
    const s = remaining % 60;
    return `${m}m${s}s`;
  }
  return `${remaining}s`;
}
