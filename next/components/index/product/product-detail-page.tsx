"use client";

import Head from "next/head";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Controls,
  Edge,
  EdgeTypes,
  MarkerType,
  MiniMap,
  Node,
  NodeTypes,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { executeFlowNode } from "../../../lib/flow-node/execute-client";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import type { ProductFlowEdge, ProductFlowNode } from "../../../lib/repo/product";
import { ProductEdge } from "../../admin/management/product/components/product-edge";
import { ProductFlowArrowMarkers } from "../../admin/management/product/components/product-flow-arrow-markers";
import { Button } from "../../shared/utilities/form";
import { BreadCrumbs, Spinner } from "../../shared/utilities/misc";
import type {
  FlowNodeData,
  NodeFieldValues,
  ProductNodeData,
} from "./components/product-node-home";
import { ProductNodeHome } from "./components/product-node-home";
import { useProductDetailContext } from "./provider/product-detail-provider";

const nodeTypes: NodeTypes = { productNode: ProductNodeHome };

/**
 * Sắp xếp thứ tự chạy node theo đồ thị (topological order).
 * Node không có cạnh vào chạy trước, sau đó lần lượt theo edges.
 * Giống N8N: chạy theo flow, dừng khi gặp lỗi.
 */
function getExecutionOrder(flowNodes: ProductFlowNode[], flowEdges: ProductFlowEdge[]): string[] {
  const ids = flowNodes.map((n) => n.id);
  const inDegree: Record<string, number> = {};
  ids.forEach((id) => (inDegree[id] = 0));
  flowEdges.forEach((e) => {
    if (ids.includes(e.target)) inDegree[e.target]++;
  });
  const queue = ids.filter((id) => inDegree[id] === 0);
  const order: string[] = [];
  while (queue.length) {
    const nodeId = queue.shift()!;
    order.push(nodeId);
    flowEdges
      .filter((e) => e.source === nodeId)
      .forEach((e) => {
        inDegree[e.target]--;
        if (inDegree[e.target] === 0) queue.push(e.target);
      });
  }
  return order;
}

/** Chuyển product.flow.nodes sang ReactFlow nodes, gắn handlers và state cho run/submit */
function buildFlowNodes(
  flowNodes: ProductFlowNode[],
  registerGetValues: (nodeId: string, getValues: () => NodeFieldValues) => void,
  onSubmitNode: (nodeId: string, fieldValues: NodeFieldValues) => void | Promise<void>,
  isRunning: boolean,
  errorNodeId: string | null
): Node<ProductNodeData>[] {
  return flowNodes.map((fn) => ({
    id: fn.id,
    type: "productNode",
    position: fn.position || { x: 0, y: 0 },
    data: {
      label: fn.data?.label,
      properties: fn.data?.properties,
      config: fn.data?.config,
      nodeId: fn.id,
      registerGetValues,
      onSubmitNode,
      isRunning,
      errorNodeId,
    } as FlowNodeData,
  }));
}

/** Chuyển product.flow.edges sang ReactFlow edges */
function buildFlowEdges(flowEdges: ProductFlowEdge[]): Edge[] {
  return (flowEdges || []).map((e) => ({
    ...e,
    type: "productEdge",
    markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8 },
  }));
}

export const ProductDetailPage = () => {
  const { t } = useTranslation();
  const { customer } = useAuth();

  const toast = useToast();
  const { product } = useProductDetailContext();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  /** Ref: nodeId -> getValues() để khi chạy auto lấy giá trị form từng node */
  const nodeGetValuesRef = useRef<Record<string, () => NodeFieldValues>>({});
  /** Đang chạy auto (disable nút Submit trong từng node) */
  const [isRunning, setIsRunning] = useState(false);
  /** Node nào lỗi khi auto-run (highlight đỏ) */
  const [errorNodeId, setErrorNodeId] = useState<string | null>(null);

  const flowNodes = product?.flow?.nodes ?? [];
  const flowEdges = product?.flow?.edges ?? [];

  const registerGetValues = useCallback((nodeId: string, getValues: () => NodeFieldValues) => {
    nodeGetValuesRef.current[nodeId] = getValues;
  }, []);

  /** Submit thủ công 1 node: gọi API execute với config của node + fieldValues */
  const handleSubmitNode = useCallback(
    async (nodeId: string, fieldValues: NodeFieldValues) => {
      const fn = flowNodes.find((n) => n.id === nodeId);
      const config = fn?.data?.config;
      if (!config?.endpoint) return;
      try {
        const result = await executeFlowNode({
          productId: product?.id,
          customerId: customer?._id || "",
          nodeId,
          fieldValues,
        });
        if (result.success) toast.success(t("Node chạy thành công."));
        else toast.error(result.error || t("Node chạy lỗi."));
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Node chạy lỗi."));
      }
    },
    [flowNodes, toast, t]
  );

  /**
   * Chạy auto toàn bộ flow: chạy lần lượt theo thứ tự topological.
   * Dừng ngay khi 1 node lỗi, set errorNodeId để highlight.
   */
  const handleRunAuto = useCallback(async () => {
    if (!flowNodes.length) return;
    setIsRunning(true);
    setErrorNodeId(null);
    const order = getExecutionOrder(flowNodes, flowEdges);
    const context: Record<string, unknown> = {};

    for (const nodeId of order) {
      const fn = flowNodes.find((n) => n.id === nodeId);
      const config = fn?.data?.config;
      if (!config?.endpoint) continue;

      const getValues = nodeGetValuesRef.current[nodeId];
      const fieldValues = getValues ? getValues() : {};
      const result = await executeFlowNode({
        productId: product?.id || "",
        nodeId,
        customerId: customer?._id || "",
        fieldValues,
        context,
      });

      if (!result.success) {
        setErrorNodeId(nodeId);
        setIsRunning(false);
        toast.error(t("Dừng tại node") + ` "${fn?.data?.label || nodeId}": ${result.error || ""}`);
        return;
      }
      context[nodeId] = result.data;
    }

    setErrorNodeId(null);
    setIsRunning(false);
    toast.success(t("Đã chạy xong toàn bộ flow."));
  }, [flowNodes, flowEdges, toast, t]);

  useEffect(() => {
    if (product?.flow?.nodes?.length) {
      setEdges(buildFlowEdges(product.flow.edges || []));
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [product?.id, JSON.stringify(product?.flow?.edges)]);

  useEffect(() => {
    if (!product?.flow?.nodes?.length) return;
    const nextNodes = buildFlowNodes(
      product.flow.nodes,
      registerGetValues,
      handleSubmitNode,
      isRunning,
      errorNodeId
    );
    setNodes(nextNodes);
  }, [
    product?.id,
    JSON.stringify(product?.flow?.nodes),
    registerGetValues,
    handleSubmitNode,
    isRunning,
    errorNodeId,
  ]);

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      productEdge: (props) => <ProductEdge {...props} />,
    }),
    []
  );

  if (!product) return <Spinner />;

  const productName = product?.name || t("Sản phẩm");
  const productDescription = product?.des ?? "";
  const productImage = product?.coverImg ?? "";
  const hasFlow = (product?.flow?.nodes?.length ?? 0) > 0;

  return (
    <>
      <Head>
        <title>
          {productName} | {t("Trang chủ")}
        </title>
        <meta name="description" content={productDescription.slice(0, 160)} />
        <meta property="og:title" content={productName} />
        <meta property="og:description" content={productDescription.slice(0, 160)} />
        <meta property="og:image" content={productImage} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <section className="flex flex-col flex-1 mx-auto w-full max-w-7xl">
        <div className="mb-4 lg:mb-6">
          <BreadCrumbs
            className="relative z-10"
            breadcrumbs={[
              { href: "/", label: t("Trang chủ") },
              { href: `/${product?.slug}`, label: productName },
            ]}
          />
        </div>

        <div className="overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm">
          {hasFlow ? (
            <>
              {/* Nút chạy auto toàn flow (N8N-style), đặt ngoài flow */}
              <div className="flex gap-2 justify-end px-4 py-2 bg-gray-50 border-b border-gray-200">
                <Button
                  primary
                  disabled={isRunning}
                  isLoading={isRunning}
                  onClick={() => handleRunAuto()}
                  text={isRunning ? t("Đang chạy...") : t("Chạy auto")}
                  tooltip={t("Chạy lần lượt tất cả node theo flow; dừng khi gặp lỗi")}
                />
              </div>
              <div
                className="relative w-full font-sans bg-gray-900 rounded-b-lg"
                style={{ height: "calc(100vh - 260px)", minHeight: 400 }}
              >
                <ProductFlowArrowMarkers />
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  edgeTypes={edgeTypes}
                  defaultEdgeOptions={{
                    animated: true,
                    markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
                  }}
                  nodeTypes={nodeTypes}
                  nodesDraggable={false}
                  nodesConnectable={false}
                  elementsSelectable={true}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  minZoom={0.2}
                  maxZoom={2}
                  className="bg-gray-900"
                >
                  <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="#fff" />
                  <Controls className="overflow-hidden bg-gray-800 rounded-lg border border-gray-300" />
                  <MiniMap
                    className="bg-white rounded-lg border border-gray-300 opacity-80"
                    nodeColor="#F2890D"
                  />
                </ReactFlow>
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 justify-center items-center py-16 text-gray-500">
              <div className="text-4xl">⚙️</div>
              <div className="text-lg font-bold text-center">{t("Sản phẩm chưa có flow.")}</div>
            </div>
          )}
        </div>
      </section>
      <style>{`
        .react-flow__node { cursor: default; }
        .react-flow__attribution { display: none; }
      `}</style>
    </>
  );
};
