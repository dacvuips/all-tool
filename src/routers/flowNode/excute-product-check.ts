import type { HydratedDocument } from "mongoose";
import { ForbiddenError } from "../../libs/core/errors";
import { CredentialModel } from "../../libs/dal/credential";
import type { ICustomer } from "../../libs/dal/customer";
import { CustomerModel } from "../../libs/dal/customer";
import type { AiProviderKeyEnum, IProduct, ProductFlowNode } from "../../libs/dal/product";
import { ProductModel } from "../../libs/dal/product";
import { CustomerStatusEnum } from "../../libs/shared/interfaces/customer.interface";
import { decryptProviderSecret } from "../../packages/encryption";

export interface ExecuteNodeResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
}

/** Helper trả về response lỗi thống nhất cho execute flow node. */

export type ExecuteProductCheckParams = {
  productId: string;
  nodeId: string;
  customerId: string;
};

export type ExecuteProductCheckSuccess = {
  ok: true;
  customer: HydratedDocument<ICustomer>;
  product: HydratedDocument<IProduct>;
  node: ProductFlowNode;
  aiProviderKey: AiProviderKeyEnum;
  credentialDecrypted: string;
};

export type ExecuteProductCheckError = {
  ok: false;
  statusCode: number;
  error: string;
};

export type ExecuteProductCheckResult = ExecuteProductCheckSuccess | ExecuteProductCheckError;

/** Trả về object lỗi thống nhất cho execute product check. */
export function createExecuteCheckError(
  statusCode: number,
  error: string
): ExecuteProductCheckError {
  return { ok: false, statusCode, error };
}

/**
 * Kiểm tra product, node, customer và trả về dữ liệu hợp lệ để execute flow node.
 * Trả về { ok: true, ... } khi hợp lệ, { ok: false, statusCode, error } khi lỗi.
 */
export async function executeProductCheck(
  params: ExecuteProductCheckParams
): Promise<ExecuteProductCheckResult> {
  const { productId, nodeId, customerId } = params;

  if (!productId || !nodeId || !customerId) {
    return createExecuteCheckError(400, "Missing product, node or customer");
  }

  let customer: HydratedDocument<ICustomer>;
  try {
    customer = await CustomerModel.findById(customerId).orFail(
      new ForbiddenError("Customer not found")
    );
  } catch {
    return createExecuteCheckError(400, "Customer not found");
  }

  if (customer.status !== CustomerStatusEnum.ACTIVE) {
    return createExecuteCheckError(403, "Customer is not active");
  }

  const product = await ProductModel.findById(productId);
  if (!product) {
    return createExecuteCheckError(400, "Product not found");
  }

  const node = product.flow?.nodes?.find((n) => n.id === nodeId);
  if (!node) {
    return createExecuteCheckError(400, "Node not found");
  }

  const aiProviderKey = node.data?.config?.aiProviderKey;
  if (!aiProviderKey) {
    return createExecuteCheckError(400, "Missing aiProviderKey in node config");
  }
  // tìm credential của customer
  const credential = await CredentialModel.findOne({
    key: aiProviderKey,
    customerId,
    isCustomerCredential: true,
    active: true,
  });
  if (!credential) {
    return createExecuteCheckError(400, "Credential not found");
  }
  const credentialDecrypted = decryptProviderSecret(credential.value);

  return {
    ok: true,
    customer,
    product,
    node,
    aiProviderKey,
    credentialDecrypted,
  };
}
