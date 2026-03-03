/**
 * API dùng chung: Execute Flow Node (src/routers).
 * Nhận config (endpoint, method, bodyTemplate), fieldValues, context;
 * thay placeholder trong bodyTemplate rồi gọi API ngoài.
 */

import axios, { AxiosRequestConfig } from "axios";
import { Request, Response } from "express";
import { parseBodyAfterReplace, replacePlaceholders } from "../../helpers/flow-node-placeholder";
import { ForbiddenError } from "../../libs/core/errors";
import { CredentialModel } from "../../libs/dal/credential";
import { CustomerModel } from "../../libs/dal/customer";
import { AiProviderKeyEnum, ProductFlowNodeData, ProductModel } from "../../libs/dal/product";
import { CustomerStatusEnum } from "../../libs/shared/interfaces/customer.interface";
import { decryptProviderSecret } from "../../packages/encryption";
interface ExecuteNodeBody {
  productId: string;
  nodeId: string;
  customerId: string;
  fieldValues?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

interface ExecuteNodeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
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

        if (!productId || !nodeId || !customerId) {
          return res.status(400).json({
            success: false,
            error: "Missing product, node or customer",
          } as ExecuteNodeResponse);
        }

        const customer = await CustomerModel.findById(customerId).orFail(
          new ForbiddenError("Customer not found")
        );
        if (customer.status !== CustomerStatusEnum.ACTIVE) {
          return res.status(403).json({
            success: false,
            error: "Customer is not active",
          } as ExecuteNodeResponse);
        }

        const product = await ProductModel.findById(productId);
        if (!product) {
          return res.status(400).json({
            success: false,
            error: "Product not found",
          } as ExecuteNodeResponse);
        }

        const node = product.flow.nodes.find((n) => n.id === nodeId);
        if (!node) {
          return res.status(400).json({
            success: false,
            error: "Node not found",
          } as ExecuteNodeResponse);
        }
        const nodeData = node.data as ProductFlowNodeData;

        // tìm credential của customer
        const credential = await CredentialModel.findOne({
          key: nodeData.config.aiProviderKey as AiProviderKeyEnum,
          customerId,
          isCustomerCredential: true,
          active: true,
        });
        if (!credential) {
          return res.status(400).json({
            success: false,
            error: "Credential not found",
          } as ExecuteNodeResponse);
        }
        const credentialDecrypted = decryptProviderSecret(credential.value);
        if (nodeData.config.aiProviderKey) {
          fieldValues[nodeData.config.aiProviderKey] = credentialDecrypted;
        }
        const rawTemplate = nodeData.config.bodyTemplate ?? "{}";
        const headers = nodeData.config.headers ?? "{}";
        const replacedTemplate = replacePlaceholders(rawTemplate, fieldValues, context);
        const replacedHeaders = replacePlaceholders(headers, fieldValues, context);
        const body = parseBodyAfterReplace(replacedTemplate);

        const headersObj = parseBodyAfterReplace(replacedHeaders);

        const method = (nodeData.config.method || "POST").toUpperCase();

        const rawUrl = nodeData.config.endpoint;
        const url = replacePlaceholders(rawUrl, fieldValues, context);
        const urlParsed = parseBodyAfterReplace(url);

        const axiosConfig: AxiosRequestConfig = {
          method: method as any,
          url: urlParsed as string,
          headers: {
            "Content-Type": "application/json",
            ...(headersObj as Record<string, string>),
          },
        };

        if (method !== "GET" && body !== undefined) {
          axiosConfig.data = body;
        }

        const externalRes = await axios.request(axiosConfig);
        const data = externalRes.data;

        return res.status(200).json({
          success: true,
          data,
        } as ExecuteNodeResponse);
      } catch (err: any) {
        const message = err?.response?.data?.message ?? err?.message ?? String(err);
        const status = err?.response?.status;
        return res.status(200).json({
          success: false,
          error: message,
          status,
          data: err?.response?.data,
        } as ExecuteNodeResponse);
      }
    },
  },
];
