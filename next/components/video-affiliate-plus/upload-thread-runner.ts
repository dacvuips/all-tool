/**
 * @deprecated Simulate path đã chuyển sang backend enqueue.
 * Giữ helper delay nếu còn import — prefer module shopee-video-upload.
 */

export function tickUploadThreads(): null {
  return null;
}

export function markThreadsRunning<T>(threads: T[]): T[] {
  return threads;
}

export function markThreadsPaused<T>(threads: T[]): T[] {
  return threads;
}

export function retryErrorThreads<T extends { status: string }>(
  threads: T[]
): { next: T[]; count: number } {
  let count = 0;
  const next = threads.map((item) => {
    if (item.status !== "error") return item;
    count += 1;
    return { ...item, status: "stopped" as T["status"] };
  });
  return { next, count };
}

export function applyDailyScheduleReset<T>(
  _threads: T[],
  _scheduleTime: string,
  lastResetKey: string
): { next: null; resetKey: string } {
  return { next: null, resetKey: lastResetKey };
}
