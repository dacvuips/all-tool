/**
 * Repository gọi GraphQL cho `MediaGenerationJob`:
 *   - Query   : `mediaGenerationJob(id)`            — lấy snapshot trạng thái (fallback poll)
 *   - Mutation: `cancelMediaGenerationJob(id)`      — huỷ job đang chạy
 *   - Mutation: `retryMediaGenerationJob(id)`       — retry job FAILED
 *   - Subscription: `mediaGenerationJobChanged(jobId)` — push update realtime
 *
 * Đây là lớp giao tiếp thô; logic ghép subscribe + fallback poll + lifecycle nằm trong
 * hook `useMediaGenerationJob`.
 */
import { GraphRepository } from "../graph.repo";

/** Trạng thái vòng đời job (đồng bộ với backend enum `MediaGenerationJobStatus`) */
export type MediaGenerationJobStatus =
  | "QUEUED"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELLED";

/** Bản ghi job — generic `T` là kiểu `resultData` (image hoặc video). */
export type MediaGenerationJob<T = unknown> = {
  id: string;
  customerId: string;
  type: string;
  status: MediaGenerationJobStatus;
  progress: number;
  message?: string | null;
  resultData?: T | null;
  errorMessage?: string | null;
  errorCode?: number | null;
  metadata?: Record<string, unknown> | null;
  attempts?: number;
  createdAt?: string;
  startedAt?: string | null;
  completedAt?: string | null;
};

const FULL_FRAGMENT = `
  id
  customerId
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

class MediaGenerationJobRepository extends GraphRepository {
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

  /** Gia hạn job watcher — gọi ngay sau enqueue + định kỳ (video dài). TTL server 60s. */
  async touchWatch(id: string): Promise<boolean> {
    const res = await this.mutate({
      mutation: `touchMediaGenerationJobWatch(id: $id)`,
      variablesParams: "($id: String!)",
      options: { variables: { id }, errorPolicy: "all" },
      clearStore: false,
    });
    return Boolean(res.data?.g0);
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
