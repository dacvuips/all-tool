/**
 * Queue xử lý AI generation: nhận runId, gọi executeByProvider, chuẩn hóa response,
 * upload ảnh/video lên MinIO, cập nhật AiGenerationRun (resultRefs, status).
 * Khi xong bắn socket (pubsub) để client cập nhật node realtime.
 *
 * Job retention 72h (jobRetentionMs): cleanup mọi job (failed, succeeded, waiting, delayed, active) quá 72h.
 * - Ưu điểm: Giảm dùng bộ nhớ Redis; tránh tích tụ job lâu ngày; dễ kiểm soát dung lượng.
 * - Nhược điểm: Sau 72h không còn xem/retry job trên Redis (kết quả vẫn nằm ở AiGenerationRun trong MongoDB).
 */
import { Job } from "bee-queue";
import { BaseQueue } from "../base/baseQueue";
import { CONSTANTS } from "../constants/constant.const";
import {
  FlowNodeRunChangeEventEnum,
  type FlowNodeRunChangePayload,
} from "../graphql/modules/flowNodeRun/flowNodeRunChangeStream.graphql";
import logger from "../helpers/logger";
import { aiGenerationRunService, AiGenerationRunStatusEnum } from "../libs/dal/aiGenerationRun";
import {
  creditTransactionService,
  CreditTransactionTypeEnum,
} from "../libs/dal/creditTransaction";
import { customerGenerationMediaService } from "../libs/dal/customerGenerationMedia";
import { ApiOutputTypeEnum } from "../libs/dal/product";
import { pubsub } from "../libs/graphql/pub-sub";
import { ChargeNodeRunCredit } from "../libs/usecases/credit/charge-node-run-credit.usecase";
import { RefundNodeRunCredit } from "../libs/usecases/credit/refund-node-run-credit.usecase";
import { executeProductCheck } from "../routers/flowNode/excute-product-check";
import {
  executeByProvider,
  ExecuteProviderContext,
  MethodEnum,
} from "../routers/flowNode/execute-provider";
import { normalizeAiResponse } from "../routers/flowNode/helpers/normalize-ai-response";

export interface AiGenerationJobPayload {
  runId: string;
}

/**
 * Queue worker: xử lý job AI generation theo runId.
 * Load run → lấy credential → gọi API → chuẩn hóa + upload → cập nhật run.
 */
/** Thời gian tối đa (ms) job active trước khi coi là stalled. AI ảnh/video thường 2–10+ phút nên dùng 15 phút. */
const AI_GENERATION_STALL_INTERVAL_MS = 20 * 60 * 1000; // 20 phút
/** Mọi job (failed, succeeded, waiting, delayed, active) tồn tại trong Redis tối đa 72h, sau đó bị cleanup. */
const AI_GENERATION_JOB_RETENTION_MS = 72 * 60 * 60 * 1000; // 72 giờ

class AiGenerationQueue extends BaseQueue {
  constructor() {
    super("AiGenerationRun", 3, {
      removeOnSuccess: true,
      removeOnFailure: false,
      stallIntervalMs: AI_GENERATION_STALL_INTERVAL_MS,
      jobRetentionMs: AI_GENERATION_JOB_RETENTION_MS,
    });
  }

  protected async process(job: Job<AiGenerationJobPayload>): Promise<void> {
    const { runId } = job.data;
    const run = await aiGenerationRunService.findOne({ _id: runId });
    if (!run) {
      this.logger.warn(`AiGenerationRun not found: ${runId}`);
      return;
    }

    const runDoc = run as any;
    const customerId = runDoc.customerId;
    const productId = runDoc.productId;
    const nodeId = runDoc.nodeId;

    if (!customerId) {
      throw new Error(`AiGenerationRun ${runId} is missing customerId.`);
    }
    if (!productId) {
      throw new Error(`AiGenerationRun ${runId} is missing productId.`);
    }
    if (!nodeId) {
      throw new Error(`AiGenerationRun ${runId} is missing nodeId.`);
    }

    const requestSnapshot = runDoc.requestSnapshot || {};
    const fieldValues = requestSnapshot.fieldValues || {};
    const context = requestSnapshot.context || {};

    const creditCost = Math.max(0, Number(runDoc.creditCost) || 0);
 
    await aiGenerationRunService.updateOne(runId, {
      status: AiGenerationRunStatusEnum.PROCESSING,
      startedAt: new Date(),
    });

    try {
      const check = await executeProductCheck({ productId, nodeId, customerId });
      if (check.ok === false) {
        await aiGenerationRunService.updateOne(runId, {
          status: AiGenerationRunStatusEnum.FAILED,
          errorMessage: check.error,
          completedAt: new Date(),
        });
        return;
      }

      const { node, aiProviderKey, credential } = check;

      if (!node?.data) {
        throw new Error(`Node ${nodeId} is missing 'data'. Cannot execute provider.`);
      }
      if (!aiProviderKey) {
        throw new Error(`Node ${nodeId} is missing aiProviderKey in config.`);
      }
      if (!credential) {
        throw new Error(`Credential not found for provider ${aiProviderKey} (customer: ${customerId}).`);
      }

      // Trừ credit khi bắt đầu xử lý (reserve). Nếu creditCost = 0 thì bỏ qua.
      if (creditCost > 0) {
        try {
          await ChargeNodeRunCredit.usecase.execute(
            ChargeNodeRunCredit.Command.create({
              customerId,
              runId: String(runDoc._id),
              productId,
              nodeId,
              amount: creditCost,
            })
          );
        } catch (chargeErr: any) {
          const msg =
            chargeErr?.message || "Số dư credit không đủ. Vui lòng nạp thêm credit để chạy node.";
          await aiGenerationRunService.updateOne(runId, {
            status: AiGenerationRunStatusEnum.FAILED,
            errorMessage: msg,
            completedAt: new Date(),
          });
          await publishFlowNodeRunChanged(runId, FlowNodeRunChangeEventEnum.FAILED);
          return;
        }
        await aiGenerationRunService.updateOne(runId, { creditChargedAt: new Date() });
      }

      const providerContext: ExecuteProviderContext = {
        nodeData: node.data,
        credential,
        credentialDecrypted: "",
        fieldValues,
        context,
        convertedImages: [],
        body: "",
        headers: {},
        url: "",
        method: MethodEnum.POST,
        outputType: (runDoc.outputType as ApiOutputTypeEnum) || ApiOutputTypeEnum.IMAGE,
      };

      const data = await executeByProvider(aiProviderKey, providerContext);
      if (data == null) {
        throw new Error(`Provider ${aiProviderKey} returned empty response for run ${runId}.`);
      }

      const outputType = (runDoc.outputType as ApiOutputTypeEnum) || ApiOutputTypeEnum.IMAGE;
      const { resultRefs, responseSummary } = await normalizeAiResponse(
        runId,
        aiProviderKey,
        outputType,
        data
      );

      await aiGenerationRunService.updateOne(runId, {
        status: AiGenerationRunStatusEnum.COMPLETED,
        resultRefs,
        responseSummary,
        completedAt: new Date(),
      });

      // Lưu từng output vào CustomerGenerationMedia để query nhanh theo customer
      if (resultRefs?.length) {
        await Promise.all(
          resultRefs.map((ref, index) =>
            customerGenerationMediaService.create({
              customerId,
              productId,
              nodeId,
              runId,
              type: ref.type,
              attachmentId: ref.attachmentId,
              url: ref.url,
              mimeType: ref.mimeType,
              size: ref.size,
              order: ref.order ?? index + 1,
            })
          )
        );
      }
      // Bắn socket để client (product flow node) cập nhật kết quả run realtime
      await publishFlowNodeRunChanged(runId, FlowNodeRunChangeEventEnum.COMPLETED);
    } catch (err: any) {
      const message = err?.response?.data?.message ?? err?.message ?? String(err);
      this.logger.error(`AiGenerationRun ${runId} failed: ${message}`, err);
      // Hoàn credit nếu đã trừ (run FAILED)
      const runAfterFail = await aiGenerationRunService.findOne({ _id: runId });
      const doc = runAfterFail as any;
      const shouldRefund =
        doc?.creditChargedAt != null &&
        doc?.creditRefundedAt == null &&
        (doc?.creditCost ?? 0) > 0;
      if (shouldRefund) {
        const chargeTx = await creditTransactionService.findOne({
          runId: String(doc._id),
          type: CreditTransactionTypeEnum.NODE_RUN_CHARGE,
        });
        const refTransactionId = chargeTx ? String((chargeTx as any)._id) : undefined;
        await RefundNodeRunCredit.usecase.execute(
          RefundNodeRunCredit.Command.create({
            customerId: doc.customerId,
            runId: String(doc._id),
            productId: doc.productId,
            nodeId: doc.nodeId,
            amount: Number(doc.creditCost) || 0,
            refTransactionId,
          })
        );
      }
      await aiGenerationRunService.updateOne(runId, {
        status: AiGenerationRunStatusEnum.FAILED,
        errorMessage: message,
        completedAt: new Date(),
        ...(shouldRefund ? { creditRefundedAt: new Date() } : {}),
      });
      // Bắn socket để client (product flow node) cập nhật kết quả run realtime
      await publishFlowNodeRunChanged(runId, FlowNodeRunChangeEventEnum.FAILED);
      throw err;
    }
  }
}

/** Bắn socket để client (product flow node) cập nhật kết quả run realtime */
async function publishFlowNodeRunChanged(
  runId: string,
  event: FlowNodeRunChangeEventEnum
): Promise<void> {
  try {
    const run = await aiGenerationRunService.findOne({ _id: runId });
    if (!run) return;
    const doc = run as any;
    const data = doc.toObject ? doc.toObject() : { ...doc };
    const payload: FlowNodeRunChangePayload = {
      runId: String(doc._id),
      nodeId: doc.nodeId,
      customerId: doc.customerId,
      productId: doc.productId,
      event,
      data,
    };
    await pubsub.publish(CONSTANTS.SOCKET_EVENT_NAME.FLOW_NODE_RUN, payload);
  } catch (e) {
    logger.error("publishFlowNodeRunChanged error", e);
  }
}

export const aiGenerationQueue = new AiGenerationQueue();

/**
 * Thêm job vào queue (gọi từ API execute).
 * Cần gọi aiGenerationQueue.defaultQueue() khi server khởi động để worker chạy.
 */
export function addAiGenerationJob(runId: string): Promise<Job<AiGenerationJobPayload>> {
  return aiGenerationQueue.queue().createJob({ runId }).save();
}

/**
 * Kiểm tra queue AI generation có đang chạy và số job active/waiting.
 * running = true khi worker đã start (defaultQueue đã gọi) và queue phản hồi checkHealth.
 */
export function getAiGenerationQueueStatus() {
  return aiGenerationQueue.getQueueStatus();
}

/**
 * Đẩy lại run vào queue (retry). Dùng khi run FAILED hoặc bị kẹt PENDING/PROCESSING.
 * Trả về job nếu đẩy thành công, null nếu run không tồn tại hoặc không cho phép retry.
 */
export async function retryAiGenerationJob(
  runId: string
): Promise<Job<AiGenerationJobPayload> | null> {
  const run = await aiGenerationRunService.findOne({ _id: runId });
  if (!run) return null;
  const status = (run as any).status;
  const allowed = [AiGenerationRunStatusEnum.FAILED, AiGenerationRunStatusEnum.PENDING];
  if (!allowed.includes(status)) return null;
  return aiGenerationQueue.queue().createJob({ runId }).save();
}
