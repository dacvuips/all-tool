"use client";

import Head from "next/head";
import { useRouter } from "next/router";
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

import { HiOutlineArrowLeft, HiOutlineBookOpen, HiOutlineClock } from "react-icons/hi";
import { HiOutlinePlay } from "react-icons/hi2";
import {
  executeFlowNode,
  pollFlowNodeRun,
  getFlowNodeRuns,
  type FlowNodeRun,
} from "../../../lib/flow-node/execute-client";
import { useFlowNodeRunChanged } from "../../../lib/hooks/useFlowNodeRunChanged";
import { parseNumber } from "../../../lib/helpers/parser";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import type { ProductFlowEdge, ProductFlowNode } from "../../../lib/repo/product";
import { ProductEdge } from "../../admin/management/product/components/product-edge";
import { ProductFlowArrowMarkers } from "../../admin/management/product/components/product-flow-arrow-markers";
import { Dialog } from "../../shared/utilities/dialog/dialog";
import { Button } from "../../shared/utilities/form";
import { BreadCrumbs, Img, NotFound, Spinner } from "../../shared/utilities/misc";
import { ProductDescription } from "./components/product-description";
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
  errorNodeId: string | null,
  latestRunByNodeId: Record<string, FlowNodeRun | null>
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
      latestRun: latestRunByNodeId[fn.id] ?? null,
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
  const router = useRouter();
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
  /** Kết quả run mới nhất theo nodeId (để node hiển thị ảnh/video sau khi job xong) */
  const [latestRunByNodeId, setLatestRunByNodeId] = useState<Record<string, FlowNodeRun | null>>({});
  const [openDescriptionDialog, setOpenDescriptionDialog] = useState(false);
  const [openHistoryDialog, setOpenHistoryDialog] = useState(false);
  const [historyRuns, setHistoryRuns] = useState<FlowNodeRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const flowNodes = product?.flow?.nodes ?? [];
  const flowEdges = product?.flow?.edges ?? [];

  const registerGetValues = useCallback((nodeId: string, getValues: () => NodeFieldValues) => {
    nodeGetValuesRef.current[nodeId] = getValues;
  }, []);

  /** Submit thủ công 1 node: gọi API execute (queue), poll runId đến khi xong, báo toast. */
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
        if (!result.success) {
          toast.error(result.error || t("Node chạy lỗi."));
          return;
        }
        if (!result.runId) {
          toast.error(t("Không nhận được runId."));
          return;
        }
        toast.success(t("Đang xử lý... Vui lòng đợi."));
        const pollResult = await pollFlowNodeRun(result.runId);
        if (pollResult.success && pollResult.run) {
          setLatestRunByNodeId((prev) => ({ ...prev, [nodeId]: pollResult.run! }));
          const count = pollResult.run.resultRefs?.length ?? 0;
          toast.success(
            count > 0
              ? t("Node chạy thành công. Đã tạo {{count}} kết quả.", { count })
              : t("Node chạy thành công.")
          );
        } else {
          toast.error(pollResult.error || t("Node chạy lỗi."));
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : t("Node chạy lỗi."));
      }
    },
    [flowNodes, product?.id, customer?._id, toast, t]
  );

  /**
   * Chạy auto toàn bộ flow: chạy lần lượt theo thứ tự topological.
   * Mỗi node: execute → nhận runId → poll đến COMPLETED/FAILED → gán context[nodeId] = run.
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
      if (!result.runId) {
        setErrorNodeId(nodeId);
        setIsRunning(false);
        toast.error(t("Không nhận được runId."));
        return;
      }

      const pollResult = await pollFlowNodeRun(result.runId);
      if (!pollResult.success || !pollResult.run) {
        setErrorNodeId(nodeId);
        setIsRunning(false);
        toast.error(
          t("Dừng tại node") + ` "${fn?.data?.label || nodeId}": ${pollResult.error || ""}`
        );
        return;
      }
      context[nodeId] = pollResult.run;
      setLatestRunByNodeId((prev) => ({ ...prev, [nodeId]: pollResult.run! }));
    }

    setErrorNodeId(null);
    setIsRunning(false);
    toast.success(t("Đã chạy xong toàn bộ flow."));
  }, [flowNodes, flowEdges, product?.id, customer?._id, toast, t]);

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
      errorNodeId,
      latestRunByNodeId
    );
    setNodes(nextNodes);
  }, [
    product?.id,
    JSON.stringify(product?.flow?.nodes),
    registerGetValues,
    handleSubmitNode,
    isRunning,
    errorNodeId,
    latestRunByNodeId,
  ]);

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      productEdge: (props) => <ProductEdge {...props} />,
    }),
    []
  );

  const handleViewDescription = useCallback(() => {
    setOpenDescriptionDialog(true);
  }, []);

  /** Mở dialog lịch sử và load danh sách run theo customer + product */
  const handleOpenHistory = useCallback(async () => {
    setOpenHistoryDialog(true);
    if (!customer?._id || !product?.id) return;
    setHistoryLoading(true);
    try {
      const res = await getFlowNodeRuns({
        customerId: customer._id,
        productId: product.id,
        limit: 30,
      });
      if (res.success && res.data) setHistoryRuns(res.data);
      else setHistoryRuns([]);
    } catch {
      setHistoryRuns([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [customer?._id, product?.id]);

  /** Socket: nhận event run completed/failed từ useFlowNodeRunChanged → cập nhật node realtime */
  const flowNodeRunChanged = useFlowNodeRunChanged(customer?._id, product?.id);
  useEffect(() => {
    if (!flowNodeRunChanged?.nodeId || !flowNodeRunChanged?.data) return;
    setLatestRunByNodeId((prev) => ({
      ...prev,
      [flowNodeRunChanged.nodeId]: flowNodeRunChanged.data as FlowNodeRun,
    }));
    if (flowNodeRunChanged.event === "completed") {
      const count = flowNodeRunChanged.data.resultRefs?.length ?? 0;
      toast.success(
        count > 0
          ? t("Node chạy xong. Đã tạo {{count}} kết quả.", { count })
          : t("Node chạy xong.")
      );
    } else if (flowNodeRunChanged.event === "failed") {
      toast.error(flowNodeRunChanged.data.errorMessage || t("Node chạy lỗi."));
    }
  }, [flowNodeRunChanged, toast, t]);

  if (!product) return <Spinner />;

  const productName = product?.name || t("Sản phẩm");
  const productDescription = product?.des ?? "";
  const productImage = product?.coverImg ?? "";
  const hasFlow = (product?.flow?.nodes?.length ?? 0) > 0;
  const productPrice = product?.price ?? 0;

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
      <section className="flex flex-col flex-1 mx-auto w-full">
        <div className="px-2 py-1 mb-4 bg-white rounded-lg border border-gray-200 lg:mb-3">
          <BreadCrumbs
            className="relative z-10"
            breadcrumbs={[
              { href: "/", label: t("Trang chủ") },
              { href: `/${product?.slug}`, label: productName },
            ]}
          />
        </div>

        <div className="overflow-hidden bg-white rounded-lg border border-gray-200 shadow-sm">
          <>
            {/* Nút chạy auto toàn flow (N8N-style), đặt ngoài flow */}
            <div className="flex gap-2 justify-end px-4 py-2 bg-gray-50 border-b border-gray-200">
              <div className="flex flex-wrap gap-2 justify-between items-center w-full">
                <div className="flex gap-2 items-center">
                  <Button
                    className="p-0 pr-2 w-4 rounded-md rounded-l-full border-r shrink-0"
                    onClick={() => router.back()}
                    tooltip={t("Quay lại")}
                    icon={<HiOutlineArrowLeft />}
                  />
                  <div>
                    <Img showImageOnClick src={productImage} className="w-10 h-10" />
                  </div>
                  <div>
                    <div className="text-lg font-bold text-ellipsis-2">{productName}</div>
                    <div className="text-sm font-bold text-primary-dark">
                      {parseNumber(productPrice)}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 whitespace-nowrap">
                  {/* View description button*/}
                  <Button
                    info
                    className="rounded-md"
                    onClick={() => handleViewDescription()}
                    text={t("Hướng dẫn")}
                    tooltip={t("Hướng dẫn sản phẩm")}
                    icon={<HiOutlineBookOpen />}
                    disabled={!product?.des}
                    small
                  />
                  <Button
                    className="rounded-md"
                    onClick={() => handleOpenHistory()}
                    text={t("Lịch sử")}
                    tooltip={t("Xem lịch sử tạo ảnh/video")}
                    icon={<HiOutlineClock />}
                    small
                  />
                  <Button
                    primary
                    className="rounded-md"
                    disabled={isRunning}
                    isLoading={isRunning}
                    onClick={() => handleRunAuto()}
                    text={isRunning ? t("Đang chạy...") : t("Chạy auto")}
                    tooltip={t("Chạy lần lượt tất cả node theo flow; dừng khi gặp lỗi")}
                    icon={<HiOutlinePlay />}
                    small
                  />
                </div>
              </div>
            </div>

            {hasFlow ? (
              <>
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
              <NotFound text={t("Sản phẩm chưa có hướng dẫn.")} />
            )}
          </>
        </div>
        <Dialog
          isOpen={openDescriptionDialog}
          onClose={() => setOpenDescriptionDialog(false)}
          title={t("Hướng dẫn sản phẩm")}
        >
          <Dialog.Body>
            <ProductDescription />
          </Dialog.Body>
        </Dialog>
        <Dialog
          isOpen={openHistoryDialog}
          onClose={() => setOpenHistoryDialog(false)}
          title={t("Lịch sử tạo ảnh/video")}
        >
          <Dialog.Body>
            {historyLoading ? (
              <Spinner />
            ) : historyRuns.length === 0 ? (
              <p className="text-gray-500 text-sm py-4">{t("Chưa có lịch sử.")}</p>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {historyRuns.map((run) => (
                  <div
                    key={run._id}
                    className="p-3 rounded-lg border border-gray-200 bg-gray-50"
                  >
                    <div className="flex justify-between items-center text-xs text-gray-600 mb-2">
                      <span>
                        {run.nodeId} · {run.status} ·{" "}
                        {run.completedAt
                          ? new Date(run.completedAt).toLocaleString()
                          : run.createdAt
                            ? new Date(run.createdAt).toLocaleString()
                            : "-"}
                      </span>
                    </div>
                    {run.resultRefs && run.resultRefs.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {run.resultRefs
                          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
                          .map((ref, idx) => (
                            <div key={idx} className="flex flex-col items-center">
                              {ref.type === "image" && ref.url && (
                                <a
                                  href={ref.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="block"
                                >
                                  <Img
                                    src={ref.url}
                                    alt=""
                                    className="w-24 h-24 object-cover rounded border"
                                  />
                                </a>
                              )}
                              {ref.type === "video" && ref.url && (
                                <a
                                  href={ref.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary text-xs mt-1"
                                >
                                  {t("Xem video")}
                                </a>
                              )}
                            </div>
                          ))}
                      </div>
                    )}
                    {run.status === "FAILED" && run.errorMessage && (
                      <p className="text-red-600 text-xs mt-1">{run.errorMessage}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Dialog.Body>
        </Dialog>
      </section>
      <style>{`
        .react-flow__node { cursor: default; }
        .react-flow__attribution { display: none; }
      `}</style>
    </>
  );
};
