/**
 * Poll upload jobs từ backend và map về thread status.
 */
import { useCallback, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { getUploadJob } from "../api/client";
import { ShopeeUploadThread } from "../types";

type SetThreads = Dispatch<SetStateAction<ShopeeUploadThread[]>>;

export function useUploadJobPoller(
  threads: ShopeeUploadThread[],
  setThreads: SetThreads,
  enabled = true
) {
  const threadsRef = useRef(threads);
  threadsRef.current = threads;

  const pollOnce = useCallback(async () => {
    const running = threadsRef.current.filter(
      (t) => t.jobId && (t.status === "running" || t.status === "stopped")
    );
    if (!running.length) return;

    await Promise.all(
      running.map(async (t) => {
        if (!t.jobId) return;
        try {
          const res = await getUploadJob(t.jobId);
          const job = res.job;
          if (!job) return;

          if (job.status === "succeeded") {
            setThreads((prev) =>
              prev.map((row) =>
                row.id === t.id
                  ? {
                      ...row,
                      status: "success",
                      pending: 0,
                      uploaded: Math.max(1, row.uploaded || 1),
                      error: "-",
                      postId: job.result?.postId,
                      postLink: job.result?.postLink,
                      nextRunAt: 0,
                    }
                  : row
              )
            );
          } else if (job.status === "failed" || job.status === "cancelled") {
            setThreads((prev) =>
              prev.map((row) =>
                row.id === t.id
                  ? {
                      ...row,
                      status: "error",
                      error: job.error || "Upload failed",
                      nextRunAt: 0,
                    }
                  : row
              )
            );
          } else if (job.status === "running" || job.status === "queued") {
            setThreads((prev) =>
              prev.map((row) =>
                row.id === t.id && row.status !== "running"
                  ? { ...row, status: "running" }
                  : row
              )
            );
          }
        } catch {
          /* ignore poll errors */
        }
      })
    );
  }, [setThreads]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(() => void pollOnce(), 2000);
    return () => clearInterval(id);
  }, [enabled, pollOnce]);
}
