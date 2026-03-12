"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineArrowLeft, HiOutlinePlus, HiOutlineRefresh } from "react-icons/hi";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
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

import { BsCashCoin } from "react-icons/bs";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  AiProviderKeyEnum,
  Product,
  ProductFlowEdge,
  ProductFlowNode,
  ProductService,
} from "../../../../lib/repo/product";
import { Button } from "../../../shared/utilities/form";
import { Spinner } from "../../../shared/utilities/misc";
import { ProductEdge } from "./components/product-edge";
import { ProductFlowArrowMarkers } from "./components/product-flow-arrow-markers";
import { FlowNodeData, ProductNode, ProductNodeData } from "./components/product-node";
import { ProductSidebar, SidebarMode } from "./components/product-sidebar";

// Register custom node types outside component to prevent re-registration on every render
const nodeTypes: NodeTypes = { productNode: ProductNode };

// Grid layout config
const NODE_WIDTH = 240;
const NODE_HEIGHT = 160;
const COLS = 4;
const GAP_X = 60;
const GAP_Y = 60;
const ORIGIN_X = 60;
const ORIGIN_Y = 60;

/** Chuyển product.flow.nodes sang ReactFlow nodes (cho flow của 1 product) */
function buildFlowNodes(
  flowNodes: ProductFlowNode[],
  productId: string,
  handlers: {
    onEditNode: (nodeId: string) => void;
    onSettingsNode: (nodeId: string) => void;
    onDeleteNode: (nodeId: string) => void;
  }
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
      onEditNode: handlers.onEditNode,
      onSettingsNode: handlers.onSettingsNode,
      onDeleteNode: handlers.onDeleteNode,
    } as FlowNodeData,
  }));
}

/** Chuyển products list sang ReactFlow nodes (danh sách sản phẩm) */
function buildProductCardNodes(
  products: Product[],
  handlers: {
    onEdit: (p: Product) => void;
    onSettings: (p: Product) => void;
    onDelete: (p: Product) => void;
    onToggleActive: (p: Product) => void;
    onAdd: () => void;
  }
): Node<ProductNodeData>[] {
  return products.map((product, index) => {
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    return {
      id: product.id,
      type: "productNode",
      position: {
        x: ORIGIN_X + col * (NODE_WIDTH + GAP_X),
        y: ORIGIN_Y + row * (NODE_HEIGHT + GAP_Y),
      },
      data: {
        product,
        onEdit: handlers.onEdit,
        onSettings: handlers.onSettings,
        onDelete: handlers.onDelete,
        onToggleActive: handlers.onToggleActive,
        onAdd: handlers.onAdd,
      },
    };
  });
}

const FLOW_EDGES_KEY = "product-flow-edges";

function loadStoredEdges(productIds: Set<string>): Edge[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(FLOW_EDGES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { source: string; target: string }[];
    return parsed
      .filter((e) => productIds.has(e.source) && productIds.has(e.target))
      .map((e, i) => ({
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
        type: "productEdge",
        markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8 },
      }));
  } catch {
    return [];
  }
}

function saveEdges(edges: Edge[]) {
  if (typeof window === "undefined") return;
  const toStore = edges.map((e) => ({ source: e.source, target: e.target }));
  localStorage.setItem(FLOW_EDGES_KEY, JSON.stringify(toStore));
}

/** Chuyển ReactFlow nodes/edges về product.flow format */
function flowStateToProductFlow(
  nodes: Node<ProductNodeData>[],
  edges: Edge[]
): { nodes: ProductFlowNode[]; edges: ProductFlowEdge[] } {
  const flowNodes: ProductFlowNode[] = nodes
    .filter((n) => n.data && "nodeId" in n.data)
    .map((n) => {
      const d = n.data as FlowNodeData;
      return {
        id: n.id,
        type: n.type || "productNode",
        position: n.position,
        data: {
          label: d.label,
          properties: d.properties,
          config: d.config,
        },
      };
    });
  const flowEdges: ProductFlowEdge[] = edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle ?? undefined,
    targetHandle: e.targetHandle ?? undefined,
  }));
  return { nodes: flowNodes, edges: flowEdges };
}

export interface ProductFlowPageProps {
  productIdParam?: string | null;
  onBack?: () => void;
}

/** Config mặc định cho node mới */
const DEFAULT_NODE_CONFIG = {
  aiProviderKey: AiProviderKeyEnum.GOOGLE_GEMINI_KEY,
  endpoint: "",
  method: "POST",
  bodyTemplate: "{ prompt: {{prompt}}, duration: {{duration}} }",
};

export function ProductFlowPage({ productIdParam, onBack }: ProductFlowPageProps = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const isFlowMode = !!productIdParam;

  // Sidebar state
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // ReactFlow nodes & edges state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Delete confirm
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const saveFlowRef = useRef<(() => void) | null>(null);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await ProductService.getAll({
        query: {
          limit: 200,
          search: search || undefined,
        },
        cache: false,
      });
      setProducts(res.data || []);
    } catch (err) {
      toast.error(t("Tải danh sách sản phẩm thất bại"));
    } finally {
      setLoading(false);
    }
  }, [search]);

  const loadProductFlow = useCallback(async (productId: string) => {
    setLoading(true);
    try {
      const product = await ProductService.getOne({
        id: productId,
        cache: false,
      });
      setCurrentProduct(product || null);
      if (product?.flow?.nodes?.length || product?.flow?.edges?.length) {
        const flowNodeHandlers = {
          onEditNode: (nodeId: string) => {
            setEditingNodeId(nodeId);
            setSidebarMode("settings");
            setSelectedProduct(product);
          },
          onSettingsNode: (nodeId: string) => {
            setEditingNodeId(nodeId);
            setSidebarMode("settings");
            setSelectedProduct(product);
          },
          onDeleteNode: (nodeId: string) => {
            setNodes((prev) => prev.filter((n) => n.id !== nodeId));
            setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
          },
        };
        setNodes(buildFlowNodes(product.flow?.nodes || [], productId, flowNodeHandlers));
        setEdges(
          (product.flow?.edges || []).map((e) => ({
            ...e,
            type: "productEdge",
            markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8 },
          }))
        );
      } else {
        setNodes([]);
        setEdges([]);
      }
    } catch (err) {
      toast.error(t("Tải flow sản phẩm thất bại"));
      setCurrentProduct(null);
      setNodes([]);
      setEdges([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isFlowMode && productIdParam) {
      loadProductFlow(productIdParam);
    } else {
      loadProducts();
    }
  }, [isFlowMode, productIdParam, loadProductFlow, loadProducts]);

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSidebarMode("edit");
  }, []);

  const handleSettings = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSidebarMode("settings");
    setEditingNodeId(null);
  }, []);

  const handleDeleteClick = useCallback((product: Product) => {
    setDeletingProduct(product);
    setDeleteConfirm(true);
  }, []);

  const handleDeleteConfirm = async () => {
    if (!deletingProduct) return;
    try {
      await ProductService.delete({ id: deletingProduct.id });
      toast.success(t("Xóa sản phẩm thành công"));
      setDeleteConfirm(false);
      setDeletingProduct(null);
      if (isFlowMode && deletingProduct.id === productIdParam) {
        if (onBack) onBack();
      } else {
        loadProducts();
      }
    } catch (err: any) {
      toast.error(`${t("Xóa thất bại")}: ${err.message}`);
    }
  };

  const handleToggleActive = useCallback(
    async (product: Product) => {
      try {
        const res = await ProductService.toggleActive(product.id);
        toast.success(t("Cập trạng thái thành công"));
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, active: res.active } : p))
        );
        if (currentProduct?.id === product.id) {
          setCurrentProduct((p) => (p ? { ...p, active: res.active } : null));
        }
      } catch {
        toast.error(t("Cập trạng thái thất bại"));
      }
    },
    [currentProduct?.id]
  );

  const handleAdd = useCallback(() => {
    setSelectedProduct(null);
    setEditingNodeId(null);
    setSidebarMode("create");
  }, []);

  const flowNodeHandlers = useMemo(
    () => ({
      onEditNode: (nodeId: string) => {
        setEditingNodeId(nodeId);
        setSidebarMode("settings");
        if (currentProduct) setSelectedProduct(currentProduct);
      },
      onSettingsNode: (nodeId: string) => {
        setEditingNodeId(nodeId);
        setSidebarMode("settings");
        if (currentProduct) setSelectedProduct(currentProduct);
      },
      onDeleteNode: (nodeId: string) => {
        setNodes((prev) => prev.filter((n) => n.id !== nodeId));
        setEdges((prev) => prev.filter((e) => e.source !== nodeId && e.target !== nodeId));
      },
    }),
    [currentProduct]
  );

  const handlers = useMemo(
    () => ({
      onEdit: handleEdit,
      onSettings: handleSettings,
      onDelete: handleDeleteClick,
      onToggleActive: handleToggleActive,
      onAdd: handleAdd,
    }),
    [handleEdit, handleSettings, handleDeleteClick, handleToggleActive, handleAdd]
  );

  const saveFlow = useCallback(async () => {
    if (!productIdParam || !currentProduct) return;
    const { nodes: flowNodes, edges: flowEdges } = flowStateToProductFlow(nodes, edges);
    try {
      await ProductService.createOrUpdate({
        id: productIdParam,
        data: { flow: { nodes: flowNodes, edges: flowEdges } },
      });
      setCurrentProduct((p) => (p ? { ...p, flow: { nodes: flowNodes, edges: flowEdges } } : null));
    } catch (err: any) {
      toast.error(t("Lưu flow thất bại") + ": " + err.message);
    }
  }, [productIdParam, currentProduct, nodes, edges, toast, t]);

  useEffect(() => {
    if (!isFlowMode) return;
    saveFlowRef.current = saveFlow;
  }, [isFlowMode, saveFlow]);

  // List mode: sync products → nodes
  useEffect(() => {
    if (!isFlowMode) {
      setNodes(buildProductCardNodes(products, handlers));
    }
  }, [isFlowMode, products, handlers]);

  const edgesLoadedRef = useRef(false);
  useEffect(() => {
    if (!isFlowMode && products.length > 0 && !edgesLoadedRef.current) {
      const ids = new Set(products.map((p) => p.id));
      setEdges(loadStoredEdges(ids));
      edgesLoadedRef.current = true;
    }
    if (products.length === 0) edgesLoadedRef.current = false;
  }, [isFlowMode, products.length]);

  useEffect(() => {
    if (!isFlowMode) saveEdges(edges);
  }, [isFlowMode, edges]);

  const onConnect = useCallback((params: Connection) => {
    setEdges((prev) => {
      const exists = prev.some((e) => e.source === params.source && e.target === params.target);
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `e-${params.source}-${params.target}-${Date.now()}`,
          source: params.source!,
          target: params.target!,
          type: "productEdge",
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed, width: 8, height: 8 },
        },
      ];
    });
  }, []);

  const debouncedSaveFlowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isFlowMode || !productIdParam) return;
    if (debouncedSaveFlowRef.current) clearTimeout(debouncedSaveFlowRef.current);
    debouncedSaveFlowRef.current = setTimeout(() => {
      saveFlowRef.current?.();
      debouncedSaveFlowRef.current = null;
    }, 800);
    return () => {
      if (debouncedSaveFlowRef.current) clearTimeout(debouncedSaveFlowRef.current);
    };
  }, [isFlowMode, productIdParam, nodes, edges]);

  const handleAddFlowNode = useCallback(() => {
    const nodeId = `node-${Date.now()}`;
    const newNode: Node<ProductNodeData> = {
      id: nodeId,
      type: "productNode",
      position: { x: 80 + (nodes.length % 4) * 280, y: 80 + Math.floor(nodes.length / 4) * 180 },
      data: {
        label: t("Tác vụ mới"),
        properties: [],
        config: { ...DEFAULT_NODE_CONFIG },
        nodeId,
        onEditNode: flowNodeHandlers.onEditNode,
        onSettingsNode: flowNodeHandlers.onSettingsNode,
        onDeleteNode: flowNodeHandlers.onDeleteNode,
      } as FlowNodeData,
    };
    setNodes((prev) => [...prev, newNode]);
  }, [nodes.length, flowNodeHandlers, t]);

  const deleteEdge = useCallback((edgeId: string) => {
    setEdges((prev) => prev.filter((e) => e.id !== edgeId));
  }, []);

  const edgeTypes: EdgeTypes = useMemo(
    () => ({
      productEdge: (props) => <ProductEdge {...props} onDelete={deleteEdge} />,
    }),
    [deleteEdge]
  );

  return (
    <div
      className="flex overflow-hidden relative flex-col w-full h-full font-sans bg-gray-900 rounded-md"
      style={{
        height: "calc(100vh - 110px)",
      }}
    >
      {/* ── TOP TOOLBAR ── */}
      <div className="flex gap-3 justify-between items-center px-4 h-14 bg-gray-800 border-b border-gray-700">
        {/* Back button when opened from table */}
        {onBack && (
          <Button
            onClick={onBack}
            outline
            icon={<HiOutlineArrowLeft className="text-lg" />}
            className="text-sm text-gray-300"
            text={t("Quay lại")}
            small
          />
        )}

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span className="text-lg font-bold text-gray-300">
            {isFlowMode ? currentProduct?.name || t("Flow sản phẩm") : t("Quản lý sản phẩm")}
          </span>
        </div>
        <div className="flex gap-1 items-center text-xs text-primary">
          <BsCashCoin />
          {currentProduct?.creditCostTotal > 0
            ? currentProduct?.creditCostTotal + " " + t("Credit")
            : t("Miễn phí")}
        </div>
        <div style={{ flex: 1 }} />

        {/* Refresh */}
        <Button
          onClick={loadProducts}
          disabled={loading}
          text={t("Tải lại")}
          icon={loading ? <Spinner /> : <HiOutlineRefresh className="text-2xl" />}
        />

        {/* Add: flow mode = Thêm node, list mode = Thêm sản phẩm */}
        {
          <Button
            onClick={handleAddFlowNode}
            primary
            icon={<HiOutlinePlus />}
            text={t("Thêm tác vụ")}
          />
        }
      </div>

      {/* ── REACTFLOW CANVAS ── */}
      <div className="relative flex-1" style={{ flex: 1, position: "relative" }}>
        {loading && products.length === 0 && (
          <div className="flex absolute inset-0 z-10 gap-2 justify-center items-center text-sm text-gray-500">
            <HiOutlineRefresh className="text-2xl animate-spin" />
            {t("Đang tải...")}
          </div>
        )}

        {!loading && isFlowMode && currentProduct && nodes.length === 0 && (
          <div className="flex absolute inset-0 z-10 flex-col gap-2 justify-center items-center text-sm text-gray-500">
            <div className="text-4xl">⚙️</div>
            <div className="text-lg font-bold text-center text-white">
              {t("Chưa có node nào. Thêm node để bắt đầu flow.")}
            </div>
            {userPermission("EDIT_PRODUCT") && (
              <Button
                onClick={handleAddFlowNode}
                primary
                icon={<HiOutlinePlus />}
                className="mt-2"
                text={t("Thêm tác vụ")}
              />
            )}
          </div>
        )}

        <ProductFlowArrowMarkers />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          edgeTypes={edgeTypes}
          defaultEdgeOptions={{
            animated: true,
            markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16 },
          }}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes}
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

      {/* ── SIDEBAR ── */}
      <ProductSidebar
        mode={sidebarMode}
        product={selectedProduct}
        onClose={() => {
          setSidebarMode(null);
          setSelectedProduct(null);
          setEditingNodeId(null);
        }}
        onSuccess={() => {
          if (isFlowMode) {
            saveFlowRef.current?.();
          } else {
            loadProducts();
          }
        }}
        editingNodeId={editingNodeId}
        selectedNodeData={
          editingNodeId
            ? (nodes.find((n) => n.id === editingNodeId)?.data as FlowNodeData | undefined) ?? null
            : null
        }
        onUpdateNode={
          isFlowMode
            ? (nodeId, data) => {
                setNodes((prev) =>
                  prev.map((n) =>
                    n.id === nodeId ? { ...n, data: { ...(n.data as FlowNodeData), ...data } } : n
                  )
                );
              }
            : undefined
        }
      />

      {/* ── DELETE CONFIRM OVERLAY ── */}
      {deleteConfirm && (
        <div className="flex fixed inset-0 justify-center items-center z-2000">
          <div className="p-4 w-full max-w-md bg-gray-800 rounded-lg border border-red-400 shadow-lg">
            <div className="mb-2 text-2xl text-center">🗑️</div>
            <div className="mb-4 text-lg font-bold text-center text-white">{t("Xóa sản phẩm")}</div>
            <div className="mb-4 text-sm text-center text-gray-500">
              {t("Bạn có chắc muốn xóa sản phẩm")}{" "}
              <strong className="text-white">{deletingProduct?.name}</strong>?{" "}
              {t("Hành động này không thể hoàn tác.")}
            </div>
            <div className="flex gap-10 justify-center">
              <Button
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeletingProduct(null);
                }}
                outline
              >
                {t("Hủy")}
              </Button>
              <Button onClick={handleDeleteConfirm} danger outline>
                {t("Xóa")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes product-edge-dash {
          to { stroke-dashoffset: -12; }
        }
        .react-flow__node { cursor: grab; }
        .react-flow__node:active { cursor: grabbing; }
        .react-flow__controls-button {
          background: #1a1a2e !important;
          border-color: rgba(79,70,229,0.3) !important;
          fill: #818cf8 !important;
        }
        .react-flow__controls-button:hover {
          background: rgba(79,70,229,0.2) !important;
        }
        .react-flow__attribution { display: none; }
      `}</style>
    </div>
  );
}
