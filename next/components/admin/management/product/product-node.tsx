"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiOutlineArrowLeft,
  HiOutlinePlus,
  HiOutlineRefresh,
  HiOutlineSearch,
} from "react-icons/hi";
import ReactFlow, {
  Background,
  BackgroundVariant,
  Connection,
  Controls,
  Edge,
  EdgeTypes,
  MiniMap,
  Node,
  NodeTypes,
  useEdgesState,
  useNodesState,
} from "reactflow";
import "reactflow/dist/style.css";

import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  Product,
  ProductService,
  ProductFlowNode,
  ProductFlowEdge,
} from "../../../../lib/repo";
import { ProductEdge } from "./components/product-edge";
import {
  ProductNode,
  ProductNodeData,
  FlowNodeData,
} from "./components/product-node";
import {
  ProductSidebar,
  SidebarMode,
} from "./components/product-sidebar";

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
  initialProductId?: string | null;
  onBack?: () => void;
}

/** Config mặc định cho node mới */
const DEFAULT_NODE_CONFIG = {
  provider: "veo3",
  endpoint: "/generate-video",
  method: "POST",
  bodyTemplate: "{ prompt: {{prompt}}, duration: {{duration}} }",
};

export function ProductFlowPage({ initialProductId = null, onBack }: ProductFlowPageProps = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [currentProduct, setCurrentProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  const isFlowMode = !!initialProductId;

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
            setEdges((prev) =>
              prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
            );
          },
        };
        setNodes(
          buildFlowNodes(
            product.flow?.nodes || [],
            productId,
            flowNodeHandlers
          )
        );
        setEdges(
          (product.flow?.edges || []).map((e) => ({
            ...e,
            type: "productEdge",
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
    if (isFlowMode && initialProductId) {
      loadProductFlow(initialProductId);
    } else {
      loadProducts();
    }
  }, [isFlowMode, initialProductId, loadProductFlow, loadProducts]);

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
      if (isFlowMode && deletingProduct.id === initialProductId) {
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
        setEdges((prev) =>
          prev.filter((e) => e.source !== nodeId && e.target !== nodeId)
        );
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
    if (!initialProductId || !currentProduct) return;
    const { nodes: flowNodes, edges: flowEdges } = flowStateToProductFlow(
      nodes,
      edges
    );
    try {
      await ProductService.createOrUpdate({
        id: initialProductId,
        data: { flow: { nodes: flowNodes, edges: flowEdges } },
      });
      setCurrentProduct((p) =>
        p ? { ...p, flow: { nodes: flowNodes, edges: flowEdges } } : null
      );
    } catch (err: any) {
      toast.error(t("Lưu flow thất bại") + ": " + err.message);
    }
  }, [initialProductId, currentProduct, nodes, edges, toast, t]);

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
      const exists = prev.some(
        (e) => e.source === params.source && e.target === params.target
      );
      if (exists) return prev;
      return [
        ...prev,
        {
          id: `e-${params.source}-${params.target}-${Date.now()}`,
          source: params.source!,
          target: params.target!,
          type: "productEdge",
        },
      ];
    });
  }, []);

  const debouncedSaveFlowRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!isFlowMode || !initialProductId) return;
    if (debouncedSaveFlowRef.current) clearTimeout(debouncedSaveFlowRef.current);
    debouncedSaveFlowRef.current = setTimeout(() => {
      saveFlowRef.current?.();
      debouncedSaveFlowRef.current = null;
    }, 800);
    return () => {
      if (debouncedSaveFlowRef.current) clearTimeout(debouncedSaveFlowRef.current);
    };
  }, [isFlowMode, initialProductId, nodes, edges]);

  const handleAddFlowNode = useCallback(() => {
    const nodeId = `node-${Date.now()}`;
    const newNode: Node<ProductNodeData> = {
      id: nodeId,
      type: "productNode",
      position: { x: 80 + (nodes.length % 4) * 280, y: 80 + Math.floor(nodes.length / 4) * 180 },
      data: {
        label: t("Node mới"),
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
      productEdge: (props) => (
        <ProductEdge {...props} onDelete={deleteEdge} />
      ),
    }),
    [deleteEdge]
  );

  const searchTimeout = useRef<any>(null);
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setSearch(e.target.value);
    }, 400);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "calc(100vh - 80px)",
        background: "#0d0d1a",
        display: "flex",
        flexDirection: "column",
        fontFamily: "Inter, sans-serif",
        position: "relative",
      }}
    >
      {/* ── TOP TOOLBAR ── */}
      <div
        style={{
          height: "56px",
          background: "#111827",
          borderBottom: "1px solid rgba(79,70,229,0.25)",
          display: "flex",
          alignItems: "center",
          padding: "0 20px",
          gap: "12px",
          flexShrink: 0,
        }}
      >
        {/* Back button when opened from table */}
        {onBack && (
          <button
            onClick={onBack}
            title={t("Quay lại danh sách")}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: "8px",
              color: "white",
              padding: "6px 10px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "13px",
              marginRight: "8px",
            }}
          >
            <HiOutlineArrowLeft style={{ fontSize: "16px" }} />
            {t("Quay lại")}
          </button>
        )}

        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: "8px",
              background: "linear-gradient(135deg,#4f46e5,#7c3aed)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
            }}
          >
            {isFlowMode ? "⚙️" : "📦"}
          </div>
          <span
            style={{ color: "white", fontWeight: 700, fontSize: "15px" }}
          >
            {isFlowMode
              ? (currentProduct?.name || t("Flow sản phẩm"))
              : t("Quản lý sản phẩm")}
          </span>
          <span
            style={{
              background: "rgba(79,70,229,0.2)",
              color: "#818cf8",
              borderRadius: "20px",
              padding: "2px 10px",
              fontSize: "12px",
              fontWeight: 600,
            }}
          >
            {isFlowMode ? nodes.length : products.length}
          </span>
        </div>

        <div style={{ flex: 1 }} />

        {/* Search */}
        <div
          style={{ position: "relative", display: "flex", alignItems: "center" }}
        >
          <HiOutlineSearch
            style={{
              position: "absolute",
              left: "10px",
              color: "#6b7280",
              fontSize: "15px",
            }}
          />
          <input
            placeholder={t("Tìm kiếm sản phẩm...")}
            onChange={handleSearchChange}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "8px",
              color: "white",
              padding: "7px 12px 7px 32px",
              fontSize: "13px",
              outline: "none",
              width: "220px",
            }}
          />
        </div>

        {/* Refresh */}
        <button
          onClick={loadProducts}
          disabled={loading}
          title={t("Tải lại")}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            color: "#9ca3af",
            padding: "7px 10px",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            fontSize: "16px",
            transition: "all 0.2s",
          }}
        >
          <HiOutlineRefresh
            style={{
              animation: loading ? "spin 1s linear infinite" : "none",
            }}
          />
        </button>

        {/* Add: flow mode = Thêm node, list mode = Thêm sản phẩm */}
        {isFlowMode ? (
          userPermission("EDIT_PRODUCT") && (
            <button
              onClick={handleAddFlowNode}
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 2px 12px rgba(79,70,229,0.4)",
                transition: "all 0.2s",
              }}
            >
              <HiOutlinePlus style={{ fontSize: "16px" }} />
              {t("Thêm node")}
            </button>
          )
        ) : (
          userPermission("CREATE_PRODUCT") && (
            <button
              onClick={() => {
                setSelectedProduct(null);
                setSidebarMode("create");
              }}
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
                border: "none",
                borderRadius: "8px",
                color: "white",
                padding: "8px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "13px",
                fontWeight: 600,
                boxShadow: "0 2px 12px rgba(79,70,229,0.4)",
                transition: "all 0.2s",
              }}
            >
              <HiOutlinePlus style={{ fontSize: "16px" }} />
              {t("Thêm sản phẩm")}
            </button>
          )
        )}
      </div>

      {/* ── REACTFLOW CANVAS ── */}
      <div style={{ flex: 1, position: "relative" }}>
        {loading && products.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              color: "#6b7280",
              fontSize: "15px",
              gap: "10px",
            }}
          >
            <HiOutlineRefresh
              style={{ animation: "spin 1s linear infinite", fontSize: "20px" }}
            />
            {t("Đang tải...")}
          </div>
        )}

        {!loading && !isFlowMode && products.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              color: "#4b5563",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "48px" }}>📦</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#6b7280" }}>
              {t("Chưa có sản phẩm nào")}
            </div>
            {userPermission("CREATE_PRODUCT") && (
              <button
                onClick={() => {
                  setSelectedProduct(null);
                  setSidebarMode("create");
                }}
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <HiOutlinePlus />
                {t("Thêm sản phẩm đầu tiên")}
              </button>
            )}
          </div>
        )}

        {!loading && isFlowMode && currentProduct && nodes.length === 0 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              color: "#4b5563",
              gap: "12px",
            }}
          >
            <div style={{ fontSize: "48px" }}>⚙️</div>
            <div style={{ fontSize: "16px", fontWeight: 600, color: "#6b7280" }}>
              {t("Chưa có node nào. Thêm node để bắt đầu flow.")}
            </div>
            {userPermission("EDIT_PRODUCT") && (
              <button
                onClick={handleAddFlowNode}
                style={{
                  background: "linear-gradient(135deg, #4f46e5, #7c3aed)",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  padding: "10px 20px",
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: "14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <HiOutlinePlus />
                {t("Thêm node")}
              </button>
            )}
          </div>
        )}

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          edgeTypes={edgeTypes}
          deleteKeyCode={["Backspace", "Delete"]}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          minZoom={0.2}
          maxZoom={2}
          style={{ background: "#0d0d1a" }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={24}
            size={1}
            color="rgba(79,70,229,0.25)"
          />
          <Controls
            style={{
              background: "#1a1a2e",
              border: "1px solid rgba(79,70,229,0.3)",
              borderRadius: "10px",
              overflow: "hidden",
            }}
          />
          <MiniMap
            style={{
              background: "#111827",
              border: "1px solid rgba(79,70,229,0.3)",
              borderRadius: "10px",
            }}
            nodeColor="#4f46e5"
            maskColor="rgba(0,0,0,0.5)"
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
                    n.id === nodeId
                      ? { ...n, data: { ...(n.data as FlowNodeData), ...data } }
                      : n
                  )
                );
              }
            : undefined
        }
      />

      {/* ── DELETE CONFIRM OVERLAY ── */}
      {deleteConfirm && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "#1a1a2e",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: "16px",
              padding: "28px",
              maxWidth: "400px",
              width: "90%",
              boxShadow: "0 8px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: "20px",
                marginBottom: "8px",
                textAlign: "center",
              }}
            >
              🗑️
            </div>
            <div
              style={{
                color: "white",
                fontWeight: 700,
                fontSize: "16px",
                textAlign: "center",
                marginBottom: "8px",
              }}
            >
              {t("Xóa sản phẩm")}
            </div>
            <div
              style={{
                color: "#9ca3af",
                fontSize: "14px",
                textAlign: "center",
                marginBottom: "20px",
              }}
            >
              {t("Bạn có chắc muốn xóa sản phẩm")}{" "}
              <strong style={{ color: "white" }}>
                {deletingProduct?.name}
              </strong>
              ? {t("Hành động này không thể hoàn tác.")}
            </div>
            <div
              style={{ display: "flex", gap: "10px", justifyContent: "center" }}
            >
              <button
                onClick={() => {
                  setDeleteConfirm(false);
                  setDeletingProduct(null);
                }}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255,255,255,0.2)",
                  background: "transparent",
                  color: "#9ca3af",
                  cursor: "pointer",
                  fontSize: "14px",
                }}
              >
                {t("Hủy")}
              </button>
              <button
                onClick={handleDeleteConfirm}
                style={{
                  padding: "8px 20px",
                  borderRadius: "8px",
                  border: "none",
                  background: "linear-gradient(135deg, #ef4444, #b91c1c)",
                  color: "white",
                  cursor: "pointer",
                  fontSize: "14px",
                  fontWeight: 600,
                  boxShadow: "0 2px 12px rgba(239,68,68,0.4)",
                }}
              >
                {t("Xóa")}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
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
