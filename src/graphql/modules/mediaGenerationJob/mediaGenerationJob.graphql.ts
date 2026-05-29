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
import { Context } from "../../../libs/graphql";
import { pubsub } from "../../../libs/graphql/pub-sub";
import {
  IMediaGenerationJob,
  mediaGenerationJobService,
} from "../../../libs/dal/mediaGenerationJob";
import {
  markMediaJobCancelled,
  MediaGenerationJobPubsubPayload,
} from "../../../queues/media-generation/job-emitter";
import { markJobWatched, refreshJobWatch } from "../../../queues/media-generation/media-job-watch";
import { retryMediaGenerationJob } from "../../../queues/media-generation/media-generation.queue";

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
  if ((job as any).customerId !== context.id) return null;
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

    extend type Query {
      """
      Lấy trạng thái 1 job (fallback poll khi socket chưa kết nối).
      """
      mediaGenerationJob(id: String!): MediaGenerationJob
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
      Gia hạn job watcher (heartbeat). Gọi định kỳ khi job đang chạy lâu (video).
      """
      touchMediaGenerationJobWatch(id: String!): Boolean
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
      touchMediaGenerationJobWatch: async (
        _root: unknown,
        args: { id: string },
        context: Context
      ) => {
        const job = await findJobOwnedOrNull(args.id, context);
        if (!job) return false;
        return refreshJobWatch(args.id, context.id);
      },
    },
    Subscription: {
      mediaGenerationJobChanged: {
        // Resolver: chuyển payload sang shape GraphQL trước khi gửi cho client
        resolve: (payload: MediaGenerationJobPubsubPayload) => payloadToGraphQL(payload),
        subscribe: withFilter(
          // QUAN TRỌNG: hàm subscribe KHÔNG được async/await — phải trả AsyncIterator trực tiếp.
          // Nếu dùng async, withFilter nhận Promise<AsyncIterator> thay vì AsyncIterator thật,
          // dẫn đến thiếu method .return() và crash "asyncIterator.return is not a function".
          //
          // Giải pháp: trả iterator ngay, còn markJobWatched chạy nền (không chờ).
          // Ownership được kiểm tra ở filter function bên dưới (theo customerId).
          ((_root: unknown, args: { jobId: string }, context: Context) => {
            if (!context.isAuth) {
              throw new Error("Bạn cần đăng nhập để theo dõi job");
            }
            // Chạy nền — không block việc trả AsyncIterator
            markJobWatched(args.jobId, context.id).catch((): void => undefined);
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
