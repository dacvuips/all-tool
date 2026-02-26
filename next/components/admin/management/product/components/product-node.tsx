import { memo } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlinePencil, HiOutlinePlus, HiOutlineTrash } from "react-icons/hi";
import { RiSettings4Line } from "react-icons/ri";
import { Handle, NodeProps, Position } from "reactflow";
import { Product } from "../../../../../lib/repo";

export type ProductNodeData = {
  product: Product;
  onEdit: (product: Product) => void;
  onSettings: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onAdd?: () => void;
};

export const ProductNode = memo(({ data }: NodeProps<ProductNodeData>) => {
  const { t } = useTranslation();
  const { product, onEdit, onSettings, onDelete, onToggleActive, onAdd } = data;

  return (
    <div
      className="product-node"
      style={{
        background: "#1a1a2e",
        border: "1.5px solid #4f46e5",
        borderRadius: "12px",
        minWidth: "220px",
        maxWidth: "220px",
        boxShadow: "0 4px 24px rgba(79,70,229,0.25)",
        overflow: "hidden",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        {product.coverImg ? (
          <img
            src={product.coverImg}
            alt={product.name}
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              objectFit: "cover",
              border: "2px solid rgba(255,255,255,0.3)",
            }}
          />
        ) : (
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "8px",
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "18px",
              color: "white",
            }}
          >
            📦
          </div>
        )}
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: "13px",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {product.name}
          </div>
          <div style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px" }}>
            {product.price
              ? new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(Number(product.price))
              : t("Chưa có giá")}
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 12px" }}>
        {/* Status toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "10px",
          }}
        >
          <span style={{ color: "#a0aec0", fontSize: "12px" }}>
            {t("Trạng thái")}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleActive(product);
            }}
            style={{
              background: product.active
                ? "linear-gradient(135deg,#22c55e,#16a34a)"
                : "#374151",
              color: "white",
              border: "none",
              borderRadius: "20px",
              padding: "3px 10px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {product.active ? t("Hoạt động") : t("Tắt")}
          </button>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {onAdd && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onAdd();
              }}
              title={t("Thêm sản phẩm")}
              style={{
                flex: "1 1 auto",
                minWidth: "36px",
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.4)",
                borderRadius: "8px",
                color: "#4ade80",
                padding: "6px 0",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "14px",
                transition: "all 0.2s",
              }}
            >
              <HiOutlinePlus />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onEdit(product);
            }}
            title={t("Chỉnh sửa")}
            style={{
              flex: 1,
              background: "rgba(79,70,229,0.15)",
              border: "1px solid rgba(79,70,229,0.4)",
              borderRadius: "8px",
              color: "#818cf8",
              padding: "6px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          >
            <HiOutlinePencil />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onSettings(product);
            }}
            title={t("Cấu hình")}
            style={{
              flex: 1,
              background: "rgba(124,58,237,0.15)",
              border: "1px solid rgba(124,58,237,0.4)",
              borderRadius: "8px",
              color: "#a78bfa",
              padding: "6px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          >
            <RiSettings4Line />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete(product);
            }}
            title={t("Xóa")}
            style={{
              flex: 1,
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "8px",
              color: "#f87171",
              padding: "6px 0",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "14px",
              transition: "all 0.2s",
            }}
          >
            <HiOutlineTrash />
          </button>
        </div>
      </div>

      {/* Handles for connecting nodes (drag from source to target) */}
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: "10px",
          height: "10px",
          background: "#4f46e5",
          border: "2px solid #818cf8",
          left: "-5px",
        }}
      />
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: "10px",
          height: "10px",
          background: "#4f46e5",
          border: "2px solid #818cf8",
          right: "-5px",
        }}
      />
    </div>
  );
});

ProductNode.displayName = "ProductNode";
