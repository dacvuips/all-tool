/**
 * Job store in-memory.
 * Tách collection/namespace khỏi media-generation.
 */
import crypto from "crypto";
import {
  ShopeeUploadJob,
  ShopeeUploadJobPayload,
  ShopeeUploadJobStatus,
} from "./upload-job.types";

const jobs = new Map<string, ShopeeUploadJob>();
const MAX_JOBS = 500;

function newId(): string {
  return crypto.randomBytes(16).toString("hex");
}

function trimStore() {
  if (jobs.size <= MAX_JOBS) return;
  const sorted = Array.from(jobs.values()).sort((a, b) => a.createdAt - b.createdAt);
  const remove = sorted.slice(0, jobs.size - MAX_JOBS);
  for (const j of remove) jobs.delete(j.id);
}

export function createUploadJob(payload: ShopeeUploadJobPayload): ShopeeUploadJob {
  const now = Date.now();
  const job: ShopeeUploadJob = {
    id: newId(),
    status: ShopeeUploadJobStatus.QUEUED,
    createdAt: now,
    updatedAt: now,
    payload,
  };
  jobs.set(job.id, job);
  trimStore();
  return job;
}

export function getUploadJob(id: string): ShopeeUploadJob | null {
  return jobs.get(id) || null;
}

export function updateUploadJob(
  id: string,
  patch: Partial<Pick<ShopeeUploadJob, "status" | "result" | "error">>
): ShopeeUploadJob | null {
  const cur = jobs.get(id);
  if (!cur) return null;
  const next: ShopeeUploadJob = {
    ...cur,
    ...patch,
    updatedAt: Date.now(),
  };
  jobs.set(id, next);
  return next;
}

export function listQueuedJobs(): ShopeeUploadJob[] {
  return Array.from(jobs.values()).filter((j) => j.status === ShopeeUploadJobStatus.QUEUED);
}

export function listJobsByThreadIds(threadIds: string[]): ShopeeUploadJob[] {
  const set = new Set(threadIds);
  return Array.from(jobs.values()).filter(
    (j) => j.payload.threadId && set.has(j.payload.threadId)
  );
}

export function cancelQueuedForThreads(threadIds: string[]): number {
  const set = new Set(threadIds);
  let n = 0;
  Array.from(jobs.values()).forEach((job) => {
    if (
      job.payload.threadId &&
      set.has(job.payload.threadId) &&
      job.status === ShopeeUploadJobStatus.QUEUED
    ) {
      job.status = ShopeeUploadJobStatus.CANCELLED;
      job.updatedAt = Date.now();
      n += 1;
    }
  });
  return n;
}
