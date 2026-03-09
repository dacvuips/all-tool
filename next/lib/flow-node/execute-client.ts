/**
 * Client helper: gọi API execute flow node (queue-based), poll run theo runId.
 * API: POST /api/flow-node/execute (trả runId), GET /api/flow-node/run/:runId, GET /api/flow-node/runs.
 */

export interface ExecuteNodeParams {
  productId: string;
  nodeId: string;
  customerId: string;
  fieldValues?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

/** Kết quả trả về từ POST execute (chỉ có runId, không chờ xong) */
export interface ExecuteNodeResult {
  success: boolean;
  runId?: string;
  message?: string;
  data?: unknown;
  error?: string;
  status?: number;
}

/** Trạng thái run (đồng bộ backend AiGenerationRunStatusEnum) */
export type FlowNodeRunStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/** Một output (ảnh/video) trong kết quả run */
export interface GenerationOutputRef {
  type: "image" | "video" | "file" | "audio";
  attachmentId?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  order?: number;
}

/** Chi tiết một run (trả về từ GET /api/flow-node/run/:runId) */
export interface FlowNodeRun {
  _id: string;
  customerId: string;
  productId: string;
  nodeId: string;
  provider: string;
  outputType: string;
  status: FlowNodeRunStatus;
  requestSnapshot?: Record<string, unknown>;
  responseSummary?: { outputCount?: number; usageMetadata?: Record<string, unknown>; model?: string };
  resultRefs?: GenerationOutputRef[];
  errorMessage?: string;
  startedAt?: string;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Kết quả khi poll xong (COMPLETED hoặc FAILED) */
export interface FlowNodeRunPollResult {
  success: boolean;
  run?: FlowNodeRun;
  data?: unknown;
  error?: string;
}

/**
 * Gọi POST /api/flow-node/execute – tạo run, đẩy job queue, trả về runId.
 */
export async function executeFlowNode(params: ExecuteNodeParams): Promise<ExecuteNodeResult> {
  const res = await fetch("/api/flow-node/execute", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      productId: params.productId,
      nodeId: params.nodeId,
      customerId: params.customerId,
      fieldValues: params.fieldValues ?? {},
      context: params.context ?? {},
    }),
  });
  const json = await res.json();
  return json as ExecuteNodeResult;
}

/**
 * Lấy chi tiết một run (GET /api/flow-node/run/:runId).
 */
export async function getFlowNodeRun(runId: string): Promise<{ success: boolean; data?: FlowNodeRun }> {
  const res = await fetch(`/api/flow-node/run/${encodeURIComponent(runId)}`);
  const json = await res.json();
  return json as { success: boolean; data?: FlowNodeRun };
}

/** Tùy chọn poll: interval ms, số lần tối đa */
export interface PollOptions {
  interval?: number;
  maxAttempts?: number;
}

/**
 * Poll GET run cho đến khi status là COMPLETED hoặc FAILED (hoặc hết maxAttempts).
 * Trả về { success, run, data?: resultRefs/raw, error? }.
 */
export async function pollFlowNodeRun(
  runId: string,
  options: PollOptions = {}
): Promise<FlowNodeRunPollResult> {
  const { interval = 2000, maxAttempts = 120 } = options; // 2s * 120 = 4 phút
  let attempts = 0;

  while (attempts < maxAttempts) {
    const { success, data: run } = await getFlowNodeRun(runId);
    if (!success || !run) {
      return { success: false, error: "Không lấy được thông tin run" };
    }
    if (run.status === "COMPLETED") {
      return { success: true, run, data: run.resultRefs ?? run };
    }
    if (run.status === "FAILED") {
      return {
        success: false,
        run,
        error: run.errorMessage || "Run thất bại",
      };
    }
    attempts++;
    await new Promise((r) => setTimeout(r, interval));
  }

  return { success: false, error: "Quá thời gian chờ kết quả" };
}

/**
 * Lấy danh sách lịch sử run (GET /api/flow-node/runs).
 */
export async function getFlowNodeRuns(params: {
  customerId: string;
  productId?: string;
  nodeId?: string;
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  data?: FlowNodeRun[];
  pagination?: { total: number; limit: number; offset: number };
}> {
  const q = new URLSearchParams();
  q.set("customerId", params.customerId);
  if (params.productId) q.set("productId", params.productId);
  if (params.nodeId) q.set("nodeId", params.nodeId);
  if (params.limit != null) q.set("limit", String(params.limit));
  if (params.offset != null) q.set("offset", String(params.offset));
  const res = await fetch(`/api/flow-node/runs?${q.toString()}`);
  const json = await res.json();
  return json as {
    success: boolean;
    data?: FlowNodeRun[];
    pagination?: { total: number; limit: number; offset: number };
  };
}
