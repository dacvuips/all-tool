/**
 * Types frontend module shopee-video-upload.
 * Bridge sang video-affiliate-plus cho Users / Generate session.
 */
export type UploadStatus = "stopped" | "running" | "success" | "error";

export const MAX_UPLOAD_ITEMS = 90;

export const COUNTRY_OPTIONS = [
  { value: "VN", label: "VN - Việt Nam" },
  { value: "TH", label: "TH - Thái Lan" },
  { value: "ID", label: "ID - Indonesia" },
  { value: "MY", label: "MY - Malaysia" },
  { value: "PH", label: "PH - Philippines" },
  { value: "SG", label: "SG - Singapore" },
];

export type ShopeeUploadThread = {
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
  nextRunAt?: number;
  /** Job id từ backend */
  jobId?: string;
  postId?: string;
  postLink?: string;
};

export type AccountGroup = {
  key: string;
  username: string;
  cookie: string;
  proxy: string;
  country: string;
  delayMin: number;
  delayMax: number;
  videos: ShopeeUploadThread[];
};

export type Check24hResult = {
  count?: number;
  canPost?: boolean;
  banned?: boolean;
  error?: string;
  success: boolean;
};

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
  params: Partial<ShopeeUploadThread>
): ShopeeUploadThread {
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
    jobId: params.jobId,
    postId: params.postId,
    postLink: params.postLink,
  };
}

export function statusLabel(status: UploadStatus): string {
  if (status === "running") return "Đang chạy";
  if (status === "success") return "Xong";
  if (status === "error") return "Lỗi";
  return "Dừng";
}

export function aggregateStatus(videos: ShopeeUploadThread[]): UploadStatus {
  if (!videos.length) return "stopped";
  if (videos.some((v) => v.status === "running")) return "running";
  if (videos.some((v) => v.status === "error")) return "error";
  if (videos.every((v) => v.status === "success")) return "success";
  return "stopped";
}

export function groupThreadsByAccount(threads: ShopeeUploadThread[]): AccountGroup[] {
  const map = new Map<string, AccountGroup>();
  for (const item of threads) {
    const key = item.username || item.id;
    const existing = map.get(key);
    if (existing) existing.videos.push(item);
    else {
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

export function randomDelaySeconds(min: number, max: number): number {
  const a = Math.max(0, Math.round(min) || 0);
  const b = Math.max(a, Math.round(max) || a);
  if (b <= a) return a;
  return a + Math.floor(Math.random() * (b - a + 1));
}

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

/** Stats theo task (MLS) */
export function computeTaskStats(threads: ShopeeUploadThread[]) {
  return {
    total: threads.length,
    waiting: threads.filter((t) => t.status === "stopped").length,
    running: threads.filter((t) => t.status === "running").length,
    success: threads.filter((t) => t.status === "success").length,
    error: threads.filter((t) => t.status === "error").length,
  };
}
