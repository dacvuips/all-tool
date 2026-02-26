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
import { Product, ProductService } from "../../../../lib/repo";
import { ProductEdge } from "./components/product-edge";
import { ProductNode, ProductNodeData } from "./components/product-node";
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

function buildNodes(
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

export interface ProductFlowPageProps {
  initialProductId?: string | null;
  onBack?: () => void;
}

export function ProductFlowPage({ initialProductId = null, onBack }: ProductFlowPageProps = {}) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");

  // Sidebar state
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // ReactFlow nodes & edges state
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  // Delete confirm
  const [deletingProduct, setDeletingProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSidebarMode("edit");
  }, []);

  const handleSettings = useCallback((product: Product) => {
    setSelectedProduct(product);
    setSidebarMode("settings");
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
      loadProducts();
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
      } catch {
        toast.error(t("Cập trạng thái thất bại"));
      }
    },
    []
  );

  const handleAdd = useCallback(() => {
    setSelectedProduct(null);
    setSidebarMode("create");
  }, []);

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

  // Sync products → nodes
  useEffect(() => {
    setNodes(buildNodes(products, handlers));
  }, [products, handlers]);

  // Load stored edges once when products are first loaded
  const edgesLoadedRef = useRef(false);
  useEffect(() => {
    if (products.length > 0 && !edgesLoadedRef.current) {
      const ids = new Set(products.map((p) => p.id));
      setEdges(loadStoredEdges(ids));
      edgesLoadedRef.current = true;
    }
    if (products.length === 0) edgesLoadedRef.current = false;
  }, [products.length]);

  // Persist edges when they change (so delete/add connection is saved)
  useEffect(() => {
    saveEdges(edges);
  }, [edges]);

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
            📦
          </div>
          <span
            style={{ color: "white", fontWeight: 700, fontSize: "15px" }}
          >
            {t("Quản lý sản phẩm")}
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
            {products.length}
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

        {/* Add button */}
        {userPermission("CREATE_PRODUCT") && (
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

        {!loading && products.length === 0 && (
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
        }}
        onSuccess={loadProducts}
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
