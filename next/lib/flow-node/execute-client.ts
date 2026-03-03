/**
 * Client helper: gọi API execute flow node (dùng chung cho submit thủ công và auto-run).
 * API nằm ở backend src/routers (flowNode/execute.route.ts), không dùng Next.js API route.
 */

/** Config node (endpoint, method, bodyTemplate) - đồng bộ với API execute trong src/routers */
export interface ExecuteNodeConfig {
  endpoint: string;
  method?: string;
  bodyTemplate?: string;
}

export interface ExecuteNodeParams {
  productId: string;
  nodeId: string;
  customerId: string;
  fieldValues?: Record<string, unknown>;
  context?: Record<string, unknown>;
}

export interface ExecuteNodeResult {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: number;
}

/**
 * Gọi API /api/flow-node/execute (backend src/routers) để thực thi một node.
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
