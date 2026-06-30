/**
 * Repository gọi GraphQL cho `MediaGenerationJob`:
 *   - Query   : `getAllMediaGenerationJob` — danh sách (admin)
 *   - Query   : `mediaGenerationJob(id)`     — lấy snapshot trạng thái (fallback poll)
 *   - Mutation: `cancelMediaGenerationJob`   — huỷ job đang chạy
 *   - Mutation: `retryMediaGenerationJob`  — retry job FAILED
 *   - Subscription: `mediaGenerationJobChanged(jobId)` — push update realtime
 */
import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

/** Trạng thái vòng đời job (đồng bộ với backend enum `MediaGenerationJobStatus`) */
export type MediaGenerationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

/** Bản ghi job — generic `T` là kiểu `resultData` (image hoặc video). */
export type MediaGenerationJob<T = unknown> = BaseModel & {
  customerId: string;
  customer?: {
    id?: string;
    email?: string;
    name?: string;
  } | null;
  type: string;
  status: MediaGenerationJobStatus;
  progress: number;
  message?: string | null;
  resultData?: T | null;
  errorMessage?: string | null;
  errorCode?: number | null;
  metadata?: Record<string, unknown> | null;
  attempts?: number;
  startedAt?: string | null;
  completedAt?: string | null;
};

const FULL_FRAGMENT = `
  id
  customerId
  customer {
    id
    email
    name
  }
  type
  status
  progress
  message
  resultData
  errorMessage
  errorCode
  metadata
  attempts
  createdAt
  startedAt
  completedAt
`;

export type WakeMediaGenerationQueueResult = {
  consumerRestarted: boolean;
  orphanedRequeued: number;
  staleRequeued: number;
  staleFailed: number;
  queueRunning: boolean;
  queueActive: number;
  queueWaiting: number;
};

class MediaGenerationJobRepository extends CrudRepository<MediaGenerationJob> {
  apiName: string = "MediaGenerationJob";
  displayName: string = t("job");
  shortFragment: string = this.parseFragment(FULL_FRAGMENT);
  fullFragment: string = this.parseFragment(FULL_FRAGMENT);

  /** Lấy snapshot trạng thái job (no-cache để luôn fresh). */
  async getJob<T = unknown>(id: string): Promise<MediaGenerationJob<T> | null> {
    const res = await this.query({
      query: `mediaGenerationJob(id: $id) { ${FULL_FRAGMENT} }`,
      variablesParams: "($id: String!)",
      options: { variables: { id }, fetchPolicy: "no-cache", errorPolicy: "all" },
    });
    return (res.data?.g0 as MediaGenerationJob<T>) ?? null;
  }

  /** Huỷ job. Worker (nếu đang chạy) sẽ dừng emit ở milestone tiếp theo. */
  async cancelJob(id: string): Promise<MediaGenerationJob | null> {
    const res = await this.mutate({
      mutation: `cancelMediaGenerationJob(id: $id) { ${FULL_FRAGMENT} }`,
      variablesParams: "($id: String!)",
      options: { variables: { id } },
      clearStore: false,
    });
    return res.data?.g0 ?? null;
  }

  /** Retry 1 job FAILED — reset state về QUEUED và enqueue lại. */
  async retryJob(id: string): Promise<MediaGenerationJob | null> {
    const res = await this.mutate({
      mutation: `retryMediaGenerationJob(id: $id) { ${FULL_FRAGMENT} }`,
      variablesParams: "($id: String!)",
      options: { variables: { id } },
      clearStore: false,
    });
    return res.data?.g0 ?? null;
  }

  /** Đánh thức queue: restart consumer + khôi phục job treo/orphan. */
  async wakeQueue(): Promise<WakeMediaGenerationQueueResult> {
    const res = await this.mutate({
      mutation: `wakeMediaGenerationQueue {
        consumerRestarted
        orphanedRequeued
        staleRequeued
        staleFailed
        queueRunning
        queueActive
        queueWaiting
      }`,
      clearStore: false,
    });
    return res.data?.g0;
  }

  /**
   * Subscribe events của 1 job. Backend filter theo (jobId, customerId).
   *
   * Trả Observable — caller gọi `.subscribe(cb)` để nhận event và lấy `.unsubscribe()`.
   */
  subscribeJobChanged<T = unknown>(jobId: string) {
    return this.subscribe({
      query: `mediaGenerationJobChanged(jobId: $jobId) { ${FULL_FRAGMENT} }`,
      variablesParams: "($jobId: String!)",
      options: { variables: { jobId } },
    }).map((res: any) => res.data?.g0 as MediaGenerationJob<T> | null);
  }
}

export const MediaGenerationJobService = new MediaGenerationJobRepository();
