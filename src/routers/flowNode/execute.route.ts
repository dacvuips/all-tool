/**
 * API dùng chung: Execute Flow Node (src/routers).
 * Nhận config (endpoint, method, bodyTemplate), fieldValues, context;
 * thay placeholder trong bodyTemplate rồi gọi API ngoài.
 */

import { Request, Response } from "express";
import {
  executeProductCheck,
  type ExecuteNodeResponse,
} from "./excute-product-check";
import { executeByProvider, ExecuteProviderContext, MethodEnum } from "./execute-provider";

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
       // check product, node, customer
        const check = await executeProductCheck({
          productId,
          nodeId,
          customerId,
        });
        if (check.ok === false) {
          return sendErrorResponse(res, check.statusCode, check.error);
        }
        const { node, aiProviderKey , credentialDecrypted} = check;

        fieldValues[aiProviderKey] = credentialDecrypted;

         
        const providerContext: ExecuteProviderContext = {
          nodeData: node.data,
          credentialDecrypted,
          fieldValues,
          context, 
          convertedImages: [],
          body: "",
          headers: {},
          url: "",
          method: MethodEnum.POST,
        };

        const data = await executeByProvider(aiProviderKey, providerContext);

        return res.status(200).json({
          success: true,
          data,
        } as ExecuteNodeResponse);
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
