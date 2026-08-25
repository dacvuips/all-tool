/**
 * Repository gọi GraphQL cho `MediaGenerationJob`:
 *   - Query   : `getAllMediaGenerationJob` — danh sách (admin)
 *   - Query   : `mediaGenerationJob(id)`     — lấy snapshot trạng thái (fallback poll)
 *   - Query   : `recentSucceededMediaGenerationJobs` — ticker job thành công gần đây
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
    avatarUrl?: string;
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

/** Item ticker job thành công gần đây (không kèm resultData). */
export type RecentSucceededMediaJob = {
  id: string;
  type: string;
  customerName: string;
  customerAvatarUrl?: string | null;
  completedAt?: string | null;
};

/** Nhãn tiếng Việt cho loại generate (MediaGenerationJobType). */
export const MEDIA_GENERATION_JOB_TYPE_LABELS: Record<string, string> = {
  GENERATION_IMAGE: "Tạo ảnh",
  GENERATION_ELEMENT_IMAGE: "Tạo ảnh hàng loạt",
  COPY_VIDEO_GENERATE_IMAGE: "Tạo ảnh sao chép",
  GENERATION_VIDEO: "Tạo video",
  GENERATION_ELEMENT_VIDEO: "Tạo video hàng loạt",
  GENERATION_ELEMENT_VIDEO_TO_VIDEO: "Video sang video",
  GENERATION_REVIEW_IMAGE: "Tạo ảnh review",
  GENERATION_REVIEW_VIDEO: "Tạo video review",
  GENERATION_WOLF_VIDEO: "Tạo video Wolf",
  GENERATION_WOLF_IMAGE: "Tạo ảnh Wolf",
  GENERATION_SHOPEE_VIDEO: "Tạo video Shopee",
  API_MEDIA_IMAGE: "Tạo ảnh",
  API_MEDIA_VIDEO: "Tạo video",
  API_MEDIA_UPSAMPLE_IMAGE: "Upscale ảnh",
  API_MEDIA_UPSAMPLE_VIDEO: "Upscale video",
  GENERATION_SCENE: "Tạo kịch bản",
  GENERATION_REVIEW_SCENE: "Tạo kịch bản review",
  STORYBOARD_ANALYSIS: "Phân tích storyboard",
  SUGGEST_CONFIG: "Gợi ý cấu hình",
  COPY_VIDEO_ANALYSIS: "Phân tích video sao chép",
  GENERATION_TRENDING: "Tạo kịch bản trending",
  VOICE_FREE_GEN_AUDIO: "Tạo audio miễn phí",
  GENERATE_TEXT: "Generate text",
};

export function getMediaGenerationJobTypeLabel(type?: string | null): string {
  if (!type) return "Tạo media";
  return MEDIA_GENERATION_JOB_TYPE_LABELS[type] || type;
}

const FULL_FRAGMENT = `
  id
  customerId
  customer {
    id
    email
    name
    avatarUrl
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

const RECENT_SUCCEEDED_FRAGMENT = `
  id
  type
  customerName
  customerAvatarUrl
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

  /** 10 job SUCCEEDED mới nhất (ticker). */
  async getRecentSucceededJobs(limit = 10): Promise<RecentSucceededMediaJob[]> {
    const res = await this.query({
      query: `recentSucceededMediaGenerationJobs(limit: $limit) { ${RECENT_SUCCEEDED_FRAGMENT} }`,
      variablesParams: "($limit: Int)",
      options: { variables: { limit }, fetchPolicy: "no-cache", errorPolicy: "all" },
    });
    return (res.data?.g0 as RecentSucceededMediaJob[]) ?? [];
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
