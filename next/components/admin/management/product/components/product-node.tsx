import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlinePencil, HiOutlineTrash } from "react-icons/hi";
import { Handle, NodeProps, Position } from "reactflow";
import { useAlert } from "../../../../../lib/providers/alert-provider";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { NodeConfig, Product, ProductFlowNodeData } from "../../../../../lib/repo/product";
import { Button } from "../../../../shared/utilities/form";

/** Data khi node là product card (danh sách sản phẩm) */
export type ProductCardNodeData = {
  product: Product;
  onEdit: (product: Product) => void;
  onSettings: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onAdd?: () => void;
};

/** Data khi node là flow node (trong flow của 1 product: properties + config) */
export type FlowNodeData = {
  /** Thông tin node từ product.flow.nodes[].data */
  label?: string;
  properties?: ProductFlowNodeData["properties"];
  config?: NodeConfig;
  nodeId: string;
  onEditNode: (nodeId: string) => void;
  onDeleteNode?: (nodeId: string) => void;
};

export type ProductNodeData = ProductCardNodeData | FlowNodeData;

function isFlowNodeData(data: ProductNodeData): data is FlowNodeData {
  return "nodeId" in data && !("product" in data);
}

export const ProductNode = memo(({ data }: NodeProps<ProductNodeData>) => {
  const { t } = useTranslation();
  const alert = useAlert();

  // Flow node: hiển thị theo node data (label, config, properties)
  if (isFlowNodeData(data)) {
    const { label, config, properties, nodeId, onEditNode, onDeleteNode } = data;
    const displayLabel = label || t("Node");

    const endpoint = config?.endpoint || "-";
    const method = config?.method || "POST";
    const fieldsCount = properties?.length ?? 0;
    const { CREDENTIAL_KEY_OPTIONS } = useOptionsTranslation();
    const aiProviderKey = useMemo(
      () => CREDENTIAL_KEY_OPTIONS.find((item) => item.value === config?.aiProviderKey),
      [config?.aiProviderKey, CREDENTIAL_KEY_OPTIONS]
    );

    return (
      <div
        className="product-node flow-node"
        style={{
          background: "#fff",
          border: "1.5px solid #4f46e5",
          borderRadius: "12px",
          minWidth: "375px",
          maxWidth: "375px",
          boxShadow: "0 4px 24px rgba(79,70,229,0.25)",
          overflow: "hidden",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div className="flex flex-row gap-2 items-center p-2 border-b border-gray-200 border-dashed last:border-b-0">
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div className="overflow-hidden text-sm font-bold whitespace-nowrap text-ellipsis">
              {displayLabel}
            </div>
            <div className="flex gap-1 items-center text-xs text-gray-500">
              <img
                src={aiProviderKey?.image ?? "-"}
                alt={aiProviderKey?.label ?? "-"}
                className="px-1 h-5 rounded-full border"
              />
              {aiProviderKey?.label} · {method} · {fieldsCount} {t("trường")}
            </div>
          </div>
        </div>

        <div className="p-2">
          <div className="mb-2 text-xs text-gray-500 word-break-all">{endpoint}</div>
          <div className="flex flex-row gap-2 justify-end">
            {onEditNode && (
              <Button
                icon={<HiOutlinePencil />}
                onClick={(e) => {
                  e.stopPropagation();
                  onEditNode(nodeId);
                }}
                tooltip={t("Chỉnh sửa")}
                textPrimary
                outline
                small
                className="rounded-lg bg-primary-light hover:bg-primary hover:text-white"
              />
            )}

            {onDeleteNode && (
              <Button
                icon={<HiOutlineTrash />}
                onClick={(e) => {
                  e.stopPropagation();
                  alert.danger(
                    t("Xóa node"),
                    t("Bạn có chắc chắn muốn xóa node này không?"),
                    t("Xóa"),
                    async () => {
                      onDeleteNode(nodeId);
                      return true;
                    }
                  );
                }}
                tooltip={t("Xóa")}
                hoverDanger
                textDanger
                outline
                small
                className="rounded-lg bg-danger-light"
              />
            )}
          </div>
        </div>

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
  }
});

ProductNode.displayName = "ProductNode";
