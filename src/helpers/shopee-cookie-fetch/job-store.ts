/**
 * Hàng đợi job lấy cookie Shopee (web ↔ extension, in-memory).
 */

export type CookieFetchJobStatus =
  | "pending"
  | "running"
  | "success"
  | "captcha"
  | "error"
  | "cancelled";

export type CookieFetchJob = {
  id: string;
  userId: string;
  username: string;
  password: string;
  loginUrl: string;
  /** SPC_F gắn vào Chrome trước khi login */
  seedSpcF?: string;
  status: CookieFetchJobStatus;
  cookie?: string;
  spcF?: string;
  error?: string;
  createdAt: number;
  updatedAt: number;
};

const jobs = new Map<string, CookieFetchJob>();

function touch(job: CookieFetchJob, patch: Partial<CookieFetchJob>): CookieFetchJob {
  const next = { ...job, ...patch, updatedAt: Date.now() };
  jobs.set(next.id, next);
  return next;
}

export function createCookieFetchJob(input: {
  userId: string;
  username: string;
  password: string;
  loginUrl?: string;
  seedSpcF?: string;
}): CookieFetchJob {
  const username = String(input.username || "").trim();
  const password = String(input.password || "").trim();
  const userId = String(input.userId || "").trim();
  if (!userId) throw new Error("Thiếu userId");
  if (!username) throw new Error("Thiếu username");
  if (!password) throw new Error("Thiếu mật khẩu — cập nhật Mật khẩu trong Quản lý người dùng");

  const job: CookieFetchJob = {
    id: `cookie-fetch-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    userId,
    username,
    password,
    loginUrl: String(input.loginUrl || "https://shopee.vn/buyer/login").trim(),
    seedSpcF: String(input.seedSpcF || "").trim(),
    status: "pending",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  jobs.set(job.id, job);

  // Giữ tối đa 50 job gần nhất
  if (jobs.size > 50) {
    const sorted = Array.from(jobs.values()).sort((a, b) => a.createdAt - b.createdAt);
    for (const old of sorted.slice(0, jobs.size - 50)) {
      jobs.delete(old.id);
    }
  }
  return job;
}

export function getCookieFetchJob(id: string): CookieFetchJob | null {
  return jobs.get(String(id || "")) || null;
}

/** Extension lấy job pending / running để xử lý. */
export function listActiveCookieFetchJobs(): CookieFetchJob[] {
  return Array.from(jobs.values())
    .filter((j) => j.status === "pending" || j.status === "running")
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function markCookieFetchRunning(id: string): CookieFetchJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  if (job.status !== "pending" && job.status !== "running") return job;
  return touch(job, { status: "running" });
}

export function completeCookieFetchJob(
  id: string,
  result: {
    status: CookieFetchJobStatus;
    cookie?: string;
    spcF?: string;
    error?: string;
  }
): CookieFetchJob | null {
  const job = jobs.get(id);
  if (!job) return null;
  return touch(job, {
    status: result.status,
    cookie: result.cookie,
    spcF: result.spcF,
    error: result.error,
    // Xóa password sau khi xong để giảm rủi ro giữ trong RAM
    password: result.status === "success" || result.status === "captcha" || result.status === "error" || result.status === "cancelled"
      ? ""
      : job.password,
  });
}

/** Public view — không trả password. */
export function toPublicCookieFetchJob(job: CookieFetchJob) {
  return {
    id: job.id,
    userId: job.userId,
    username: job.username,
    loginUrl: job.loginUrl,
    status: job.status,
    cookie: job.cookie || "",
    spcF: job.spcF || "",
    error: job.error || "",
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
