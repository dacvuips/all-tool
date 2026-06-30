/**
 * GraphQL schema + resolver cho Media Generation Job (ảnh/video).
 *
 * Cung cấp 3 thứ:
 *   - Query  `mediaGenerationJob(id)`         — fallback poll khi socket chưa kết nối.
 *   - Mutation `cancelMediaGenerationJob(id)` — user huỷ job đang chạy.
 *   - Mutation `retryMediaGenerationJob(id)`  — thử lại job FAILED.
 *   - Subscription `mediaGenerationJobChanged(jobId)` — push update realtime.
 *
 * Bảo mật:
 *   - Mọi resolver yêu cầu user đăng nhập (`context.isAuth`).
 *   - Filter subscription dùng *cả* `jobId` lẫn `customerId` — đảm bảo không leak
 *     event của user khác.
 *   - Query/mutation kiểm tra `job.customerId === context.id` (không cho phép user A đọc job của B).
 */
import { gql, withFilter } from "apollo-server-express";
import { CONSTANTS } from "../../../constants/constant.const";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { CustomerLoader } from "../../../libs/dal/customer";
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";
import { GraphqlResolver } from "../../graphqlResolver";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
} from "../../../libs/dal/mediaGenerationJob";
import {
  markMediaJobCancelled,
  MediaGenerationJobPubsubPayload,
} from "../../../queues/media-generation/job-emitter";
import { retryMediaGenerationJob, wakeMediaGenerationQueue } from "../../../queues/media-generation/media-generation.queue";

/** Chuẩn hoá doc Mongo → object trả về cho GraphQL */
function toGraphQLJob(doc: IMediaGenerationJob | null | undefined): Record<string, unknown> | null {
  if (!doc) return null;
  const json: any = (doc as any).toObject ? (doc as any).toObject() : doc;
  return {
    id: String(json._id),
    customerId: json.customerId,
    type: json.type,
    status: json.status,
    progress: json.progress ?? 0,
    message: json.message ?? null,
    resultData: json.resultData ?? null,
    errorMessage: json.errorMessage ?? null,
    errorCode: json.errorCode ?? null,
    metadata: json.metadata ?? null,
    attempts: json.attempts ?? 0,
    createdAt: json.createdAt,
    startedAt: json.startedAt ?? null,
    completedAt: json.completedAt ?? null,
  };
}

/** Convert pubsub payload (camelCase) → GraphQL object */
function payloadToGraphQL(payload: MediaGenerationJobPubsubPayload): Record<string, unknown> {
  return {
    id: payload.jobId,
    customerId: payload.customerId,
    type: payload.type,
    status: payload.status,
    progress: payload.progress,
    message: payload.message ?? null,
    resultData: payload.resultData ?? null,
    errorMessage: payload.errorMessage ?? null,
    errorCode: payload.errorCode ?? null,
    metadata: payload.metadata ?? null,
    createdAt: payload.createdAt,
    startedAt: payload.startedAt ?? null,
    completedAt: payload.completedAt ?? null,
    attempts: undefined, // payload không truyền attempts; client query thêm nếu cần
  };
}

function canAccessJob(job: IMediaGenerationJob, context: Context): boolean {
  if (context.isAdmin || context.isStaff) return true;
  const ownerId = context.isShop ? context.shopOwnerId : context.id;
  return (job as any).customerId === ownerId;
}

/** Poll / heartbeat: trả null/false thay vì throw — tránh log ồn khi job đã xóa khỏi Mongo. */
async function findJobOwnedOrNull(
  jobId: string,
  context: Context
): Promise<IMediaGenerationJob | null> {
  if (!context.isAuth) {
    throw new Error("Bạn cần đăng nhập");
  }
  const job = (await mediaGenerationJobService.findOne({
    _id: jobId,
  })) as unknown as IMediaGenerationJob | null;
  if (!job) return null;
  if (!canAccessJob(job, context)) return null;
  return job;
}

/** Cancel / retry: throw rõ ràng khi job không tồn tại hoặc không thuộc user. */
async function ensureJobOwner(jobId: string, context: Context): Promise<IMediaGenerationJob> {
  const job = await findJobOwnedOrNull(jobId, context);
  if (!job) {
    throw new Error("Không tìm thấy job");
  }
  return job;
}

export default {
  schema: gql`
    type MediaGenerationJob {
      id: String
      customerId: String
      customer: Customer
      type: String
      status: String
      progress: Int
      message: String
      resultData: Mixed
      errorMessage: String
      errorCode: Int
      metadata: Mixed
      attempts: Int
      createdAt: DateTime
      startedAt: DateTime
      completedAt: DateTime
    }

    type MediaGenerationJobPageData {
      data: [MediaGenerationJob]
      total: Int
      pagination: Pagination
    }

    type WakeMediaGenerationQueueResult {
      consumerRestarted: Boolean
      orphanedRequeued: Int
      staleRequeued: Int
      staleFailed: Int
      queueRunning: Boolean
      queueActive: Int
      queueWaiting: Int
    }

    extend type Query {
      """
      Lấy trạng thái 1 job (fallback poll khi socket chưa kết nối).
      """
      mediaGenerationJob(id: String!): MediaGenerationJob

      """
      Danh sách job (admin/staff).
      """
      getAllMediaGenerationJob(q: QueryGetListInput): MediaGenerationJobPageData
    }

    extend type Mutation {
      """
      Huỷ 1 job đang chạy. Worker sẽ dừng emit progress và đánh dấu CANCELLED.
      """
      cancelMediaGenerationJob(id: String!): MediaGenerationJob

      """
      Đẩy lại 1 job FAILED vào queue (reset progress).
      """
      retryMediaGenerationJob(id: String!): MediaGenerationJob

      """
      Đánh thức queue media generation (restart consumer + khôi phục job treo).
      """
      wakeMediaGenerationQueue: WakeMediaGenerationQueueResult
    }

    extend type Subscription {
      """
      Nhận update realtime cho 1 jobId cụ thể. Server tự lọc theo customerId.
      """
      mediaGenerationJobChanged(jobId: String!): MediaGenerationJob
    }
  `,
  resolver: {
    Query: {
      mediaGenerationJob: async (
        _root: unknown,
        args: { id: string },
        context: Context
      ) => {
        const job = await findJobOwnedOrNull(args.id, context);
        return toGraphQLJob(job);
      },
      getAllMediaGenerationJob: async (
        _root: unknown,
        args: { q?: Record<string, unknown> },
        context: Context
      ) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF);
        const result = await mediaGenerationJobService.fetch(args.q);
        return {
          ...result,
          data: (result?.data || []).map((doc: IMediaGenerationJob) => toGraphQLJob(doc)),
        };
      },
    },
    Mutation: {
      cancelMediaGenerationJob: async (
        _root: unknown,
        args: { id: string },
        context: Context
      ) => {
        const job = await ensureJobOwner(args.id, context);
        await markMediaJobCancelled(args.id, (job as any).customerId);
        // Đọc lại để trả snapshot mới nhất (status CANCELLED)
        const updated = (await mediaGenerationJobService.findOne({
          _id: args.id,
        })) as unknown as IMediaGenerationJob | null;
        return toGraphQLJob(updated);
      },
      retryMediaGenerationJob: async (
        _root: unknown,
        args: { id: string },
        context: Context
      ) => {
        await ensureJobOwner(args.id, context);
        await retryMediaGenerationJob(args.id);
        const updated = (await mediaGenerationJobService.findOne({
          _id: args.id,
        })) as unknown as IMediaGenerationJob | null;
        return toGraphQLJob(updated);
      },
      wakeMediaGenerationQueue: async (
        _root: unknown,
        _args: unknown,
        context: Context
      ) => {
        context.auth(TOKEN_ROLES.ADMIN_STAFF);
        return wakeMediaGenerationQueue();
      },
    },
    MediaGenerationJob: {
      customer: GraphqlResolver.loadById(CustomerLoader, "customerId"),
    },
    Subscription: {
      mediaGenerationJobChanged: {
        // Resolver: chuyển payload sang shape GraphQL trước khi gửi cho client
        resolve: (payload: MediaGenerationJobPubsubPayload) => payloadToGraphQL(payload),
        subscribe: withFilter(
          ((_root: unknown, _args: { jobId: string }, context: Context) => {
            if (!context.isAuth) {
              throw new Error("Bạn cần đăng nhập để theo dõi job");
            }
            return pubsub.asyncIterator(CONSTANTS.SOCKET_EVENT_NAME.MEDIA_GENERATION_JOB);
          }) as any,
          (
            payload: MediaGenerationJobPubsubPayload,
            args: { jobId: string },
            context: Context
          ) => {
            if (!payload) return false;
            if (!context.isAuth) return false;
            // 2 lớp filter: jobId khớp + customerId là chính chủ
            if (args.jobId !== payload.jobId) return false;
            if (context.id !== payload.customerId) return false;
            return true;
          }
        ),
      },
    },
  },
};
