/**
 * batchRetryFailed.ts
 * Logic dùng chung: thu thập phân cảnh lỗi (image / video / extend) và chạy lại theo worker pool.
 */
import type { SceneErrorKind, SceneErrors } from "../hook/useSceneErrorBroadcast";

export interface FailedRetryTask<TScene> {
  scene: TScene;
  /** Cảnh kế tiếp – bắt buộc khi kind === "extend" */
  nextScene?: TScene;
  kind: SceneErrorKind;
}

export interface BatchRetryProgress {
  setTotal: (n: number) => void;
  setCompleted: (n: number) => void;
  setErrors: (n: number) => void;
  setCurrentLabel: (label: string) => void;
}

/**
 * Thu thập các task cần chạy lại từ state lỗi inline (image / video / extend).
 */
export function collectFailedRetryTasks<TScene extends { id: string; disabled?: boolean }>(
  scenes: TScene[],
  getSceneErrors: (sceneId: string) => SceneErrors
): FailedRetryTask<TScene>[] {
  const eligible = scenes.filter((s) => !s.disabled);
  const tasks: FailedRetryTask<TScene>[] = [];

  for (let i = 0; i < eligible.length; i++) {
    const scene = eligible[i];
    const errors = getSceneErrors(scene.id);
    if (errors.image) {
      tasks.push({ scene, kind: "image" });
    }
    if (errors.video) {
      tasks.push({ scene, kind: "video" });
    }
    if (errors.extend) {
      const nextScene = eligible[i + 1];
      if (nextScene) {
        tasks.push({ scene, nextScene, kind: "extend" });
      }
    }
  }

  return tasks;
}

export function countFailedRetryTasks<TScene extends { id: string; disabled?: boolean }>(
  scenes: TScene[],
  getSceneErrors?: (sceneId: string) => SceneErrors
): number {
  if (!getSceneErrors) return 0;
  return collectFailedRetryTasks(scenes, getSceneErrors).length;
}

/**
 * Chạy lại các task lỗi song song với worker pool.
 * `executeTask` trả về true nếu thành công, false nếu lỗi.
 */
export async function runBatchRetryWorkerPool<TScene>(options: {
  tasks: FailedRetryTask<TScene>[];
  concurrency: number;
  stopRef: { current: boolean };
  progress: BatchRetryProgress;
  getTaskLabel: (task: FailedRetryTask<TScene>) => string;
  executeTask: (task: FailedRetryTask<TScene>) => Promise<boolean>;
}): Promise<{ completed: number; errors: number; stopped: boolean }> {
  const { tasks, concurrency, stopRef, progress, getTaskLabel, executeTask } = options;

  progress.setTotal(tasks.length);
  progress.setCompleted(0);
  progress.setErrors(0);
  progress.setCurrentLabel("");

  let completed = 0;
  let errors = 0;
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      if (stopRef.current) return;

      const idx = nextIndex++;
      if (idx >= tasks.length) return;

      const task = tasks[idx];
      progress.setCurrentLabel(getTaskLabel(task));

      let ok = false;
      try {
        ok = await executeTask(task);
      } catch {
        ok = false;
      }

      if (ok) {
        completed++;
      } else {
        errors++;
      }
      progress.setCompleted(completed + errors);
      progress.setErrors(errors);
    }
  };

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return { completed: completed + errors, errors, stopped: stopRef.current };
}
