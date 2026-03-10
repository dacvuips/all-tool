/**
 * API lấy thông tin một run (theo runId), danh sách lịch sử run (theo customer, product),
 * và trạng thái queue AI generation.
 */

import { Request, Response } from "express";
import { aiGenerationRunService } from "../../libs/dal/aiGenerationRun";
import { getAiGenerationQueueStatus, retryAiGenerationJob } from "../../queues/ai-generation.queue";

/** GET /api/flow-node/run/:runId - Lấy chi tiết một run (để poll kết quả hoặc xem lại) */
async function getRun(req: Request, res: Response) {
  const runId = req.params.runId;
  if (!runId) {
    return res.status(400).json({ success: false, error: "Thiếu runId" });
  }

  const run = await aiGenerationRunService.findOne({ _id: runId });
  if (!run) {
    return res.status(404).json({ success: false, error: "Không tìm thấy run" });
  }

  const runObj = (run as any).toObject?.() ?? run;
  return res.status(200).json({ success: true, data: runObj });
}

/** GET /api/flow-node/runs - Lịch sử run theo customerId (và tùy chọn productId, limit, offset) */
async function getRuns(req: Request, res: Response) {
  const customerId = req.query.customerId as string;
  const productId = req.query.productId as string | undefined;
  const nodeId = req.query.nodeId as string | undefined;
  const limit = Math.min(parseInt(req.query.limit as string, 10) || 20, 100);
  const offset = parseInt(req.query.offset as string, 10) || 0;

  if (!customerId) {
    return res.status(400).json({ success: false, error: "Thiếu customerId" });
  }

  const filter: Record<string, unknown> = { customerId };
  if (productId) filter.productId = productId;
  if (nodeId) filter.nodeId = nodeId;

  const [data, total] = await Promise.all([
    aiGenerationRunService.findAll({
      filter,
      order: { createdAt: -1 },
      limit,
      offset,
    }),
    aiGenerationRunService.count({ filter }),
  ]);

  const list = Array.isArray(data) ? data.map((r: any) => (r.toObject ? r.toObject() : r)) : [];

  return res.status(200).json({
    success: true,
    data: list,
    pagination: { total, limit, offset },
  });
}

/** GET /api/flow-node/queue/status - Kiểm tra queue AI generation có đang chạy và số job active/waiting */
async function getQueueStatus(_req: Request, res: Response) {
  const status = await getAiGenerationQueueStatus();
  return res.status(200).json({
    success: true,
    data: {
      queueName: "AiGenerationRun",
      ...status,
    },
  });
}

/** POST /api/flow-node/run/:runId/retry - Đẩy lại run (FAILED/PENDING) vào queue để xử lý lại */
async function retryRun(req: Request, res: Response) {
  const runId = req.params.runId;
  if (!runId) {
    return res.status(400).json({ success: false, error: "Thiếu runId" });
  }
  const job = await retryAiGenerationJob(runId);
  if (!job) {
    return res.status(400).json({
      success: false,
      error: "Run không tồn tại hoặc không thể retry (chỉ retry khi status FAILED hoặc PENDING)",
    });
  }
  return res.status(202).json({
    success: true,
    runId,
    message: "Đã đưa lại vào queue, poll GET /api/flow-node/run/:runId để xem kết quả.",
  });
}

export default [
  { method: "get", path: "/api/flow-node/run/:runId", midd: [], action: getRun },
  { method: "get", path: "/api/flow-node/runs", midd: [], action: getRuns },
  { method: "get", path: "/api/flow-node/queue/status", midd: [], action: getQueueStatus },
  { method: "post", path: "/api/flow-node/run/:runId/retry", midd: [], action: retryRun },
];
