/**
 * API dùng chung: Execute Flow Node (src/routers).
 * Tạo AiGenerationRun, đẩy job vào queue, trả về runId để client poll hoặc xem lịch sử.
 */

import { Request, Response } from "express";
import { ApiOutputTypeEnum } from "../../libs/dal/product";
import { AiGenerationRunStatusEnum, aiGenerationRunService } from "../../libs/dal/aiGenerationRun";
import { addAiGenerationJob } from "../../queues/ai-generation.queue";
import { executeProductCheck, type ExecuteNodeResponse } from "./excute-product-check";

interface ExecuteNodeBody {
  productId: string;
  nodeId: string;
  customerId: string;
  fieldValues?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export function sendErrorResponse(
  res: Response,
  statusCode: number,
  error: string,
  extra?: Partial<ExecuteNodeResponse>
): Response {
  return res.status(statusCode).json({
    success: false,
    error,
    ...extra,
  } as ExecuteNodeResponse);
}

export default [
  {
    method: "post",
    path: "/api/flow-node/execute",
    midd: [],
    action: async (req: Request, res: Response) => {
      try {
        const {
          productId,
          nodeId,
          customerId,
          fieldValues = {},
          context = {},
        } = req.body as ExecuteNodeBody;

        const check = await executeProductCheck({
          productId,
          nodeId,
          customerId,
        });
        if (check.ok === false) {
          return sendErrorResponse(res, check.statusCode, check.error);
        }

        const { node, aiProviderKey } = check;
        const outputType =
          (node.data?.config?.outputType as ApiOutputTypeEnum) || ApiOutputTypeEnum.IMAGE;
        const creditCost = Math.max(0, Number(node.data?.config?.creditCost) || 0);

        const run = await aiGenerationRunService.create({
          customerId,
          productId,
          nodeId,
          provider: aiProviderKey,
          outputType,
          status: AiGenerationRunStatusEnum.PENDING,
          requestSnapshot: { fieldValues, context },
          creditCost,
        });

        const runId = (run as any)._id?.toString();
        if (!runId) {
          return sendErrorResponse(res, 500, "Tạo run thất bại");
        }

        await addAiGenerationJob(runId);

        return res.status(202).json({
          success: true,
          runId,
          message: "Đã đưa vào queue, vui lòng poll GET /api/flow-node/run/:runId để lấy kết quả.",
        } as ExecuteNodeResponse & { runId: string; message?: string });
      } catch (err: any) {
        const message = err?.response?.data?.message ?? err?.message ?? String(err);
        return sendErrorResponse(res, 200, message, {
          status: err?.response?.status,
          data: err?.response?.data,
        });
      }
    },
  },
];
