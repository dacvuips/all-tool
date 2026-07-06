export type ThreadStatus = "waiting" | "uploading" | "success" | "error" | "stopped" | "running";

export interface AffiliatePlusItem {
  id: string;
  shopName: string;
  shopId: string;
  commission: string;
  imageUrl: string;
  videoUrls: string[];
  hostPort: string;
  country: string;
  cookie: string;
  uploaded: number;
  pending: number;
  delayMin: number;
  delayMax: number;
  error: string;
  status: ThreadStatus;
  selected: boolean;
  countdown: number;
}

export interface AffiliatePlusUser {
  id: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  createdAt: string;
}

export interface AffiliatePlusLog {
  id: string;
  time: string;
  level: "info" | "success" | "warning" | "error";
  message: string;
  threadId?: string;
}

export interface AffiliatePlusSettings {
  scheduleTime: string;
  defaultDelayMin: number;
  defaultDelayMax: number;
  defaultCountry: string;
  autoRetry: boolean;
}

export const STORAGE_KEY = "video-affiliate-plus-items";
export const USERS_STORAGE_KEY = "video-affiliate-plus-users";
export const LOGS_STORAGE_KEY = "video-affiliate-plus-logs";
export const SETTINGS_STORAGE_KEY = "video-affiliate-plus-settings";

export const DEFAULT_SETTINGS: AffiliatePlusSettings = {
  scheduleTime: "07:00",
  defaultDelayMin: 180,
  defaultDelayMax: 245,
  defaultCountry: "VN",
  autoRetry: true,
};

export function createEmptyItem(partial?: Partial<AffiliatePlusItem>): AffiliatePlusItem {
  return {
    id: crypto.randomUUID(),
    shopName: "",
    shopId: "",
    commission: "",
    imageUrl: "",
    videoUrls: [],
    hostPort: "",
    country: "VN",
    cookie: "",
    uploaded: 0,
    pending: 0,
    delayMin: 180,
    delayMax: 245,
    error: "",
    status: "waiting",
    selected: false,
    countdown: 0,
    ...partial,
  };
}

export function getTotalVideos(item: AffiliatePlusItem): number {
  return Math.max(item.videoUrls.length, item.uploaded + item.pending, 1);
}

export const STATUS_LABELS: Record<ThreadStatus, string> = {
  waiting: "Chờ",
  uploading: "Đang upload",
  success: "Thành công",
  error: "Lỗi",
  stopped: "Dừng",
  running: "Đang chạy",
};

export const STATUS_COLORS: Record<ThreadStatus, string> = {
  waiting: "bg-amber-50 text-amber-700 border-amber-200",
  uploading: "bg-sky-50 text-sky-700 border-sky-200",
  success: "bg-emerald-50 text-emerald-700 border-emerald-200",
  error: "bg-rose-50 text-rose-700 border-rose-200",
  stopped: "bg-gray-100 text-gray-600 border-gray-200",
  running: "bg-blue-50 text-blue-700 border-blue-200",
};
