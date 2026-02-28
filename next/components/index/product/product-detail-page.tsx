"use client";

import Head from "next/head";
import { useEffect, useMemo } from "react";
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

import type { ProductFlowEdge, ProductFlowNode } from "../../../lib/repo";
import { ProductEdge } from "../../admin/management/product/components/product-edge";
import { ProductFlowArrowMarkers } from "../../admin/management/product/components/product-flow-arrow-markers";
import { BreadCrumbs, Spinner } from "../../shared/utilities/misc";
import type { FlowNodeData, ProductNodeData } from "./components/product-node-home";
import { ProductNodeHome } from "./components/product-node-home";
import { useProductDetailContext } from "./provider/product-detail-provider";

const nodeTypes: NodeTypes = { productNode: ProductNodeHome };

/** Chuyển product.flow.nodes sang ReactFlow nodes (chế độ chỉ xem, không có handler chỉnh sửa) */
function buildFlowNodes(flowNodes: ProductFlowNode[]): Node<ProductNodeData>[] {
  return flowNodes.map((fn) => ({
    id: fn.id,
    type: "productNode",
    position: fn.position || { x: 0, y: 0 },
    data: {
      label: fn.data?.label,
      properties: fn.data?.properties,
      config: fn.data?.config,
      nodeId: fn.id,
      onSubmitNode: () => {},
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
  const { product } = useProductDetailContext();

  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    if (product?.flow?.nodes?.length) {
      setNodes(buildFlowNodes(product.flow.nodes));
      setEdges(buildFlowEdges(product.flow.edges || []));
    } else {
      setNodes([]);
      setEdges([]);
    }
  }, [product?.id, JSON.stringify(product?.flow)]);

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      productEdge: (props) => <ProductEdge {...props} />,
    }),
    []
  );

  if (!product) return <Spinner />;

  const productName = product?.name || t("Sản phẩm");
  const productDescription = product?.des || "";
  const productImage = product?.coverImg || "";
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
            <div
              className="relative w-full font-sans bg-gray-900 rounded-b-lg"
              style={{ height: "calc(100vh - 200px)", minHeight: 400 }}
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
