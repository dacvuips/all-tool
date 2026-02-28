import { memo, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Handle, NodeProps, Position } from "reactflow";
import {
  NodeConfig,
  Product,
  ProductFlowNodeData,
  Property,
  PropertyTypeEnum,
} from "../../../../lib/repo";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  Select,
  Switch,
  Textarea,
} from "../../../shared/utilities/form";
import { NotFound } from "../../../shared/utilities/misc";
import { useFormContext } from "react-hook-form";

/** Data khi node là product card (danh sách sản phẩm) */
export type ProductCardNodeData = {
  product: Product;
  onEdit: (product: Product) => void;
  onSettings: (product: Product) => void;
  onDelete: (product: Product) => void;
  onToggleActive: (product: Product) => void;
  onAdd?: () => void;
};

/** Giá trị form theo key (để submit API execute node) */
export type NodeFieldValues = Record<string, unknown>;

/** Data khi node là flow node (trong flow của 1 product: properties + config) */
export type FlowNodeData = {
  label?: string;
  properties?: ProductFlowNodeData["properties"];
  config?: NodeConfig;
  nodeId: string;
  /** Đăng ký getValues() của form node để parent lấy giá trị khi chạy auto */
  registerGetValues?: (nodeId: string, getValues: () => NodeFieldValues) => void;
  /** Submit thủ công 1 node: gọi API execute với config + fieldValues */
  onSubmitNode?: (nodeId: string, fieldValues: NodeFieldValues) => void | Promise<void>;
  /** Đang chạy auto (disable nút Submit trong node) */
  isRunning?: boolean;
  /** Node nào đang lỗi (highlight) */
  errorNodeId?: string | null;
};

export type ProductNodeData = ProductCardNodeData | FlowNodeData;

function isFlowNodeData(data: ProductNodeData): data is FlowNodeData {
  return "nodeId" in data && !("product" in data);
}

export const ProductNodeHome = memo(({ data }: NodeProps<ProductNodeData>) => {
  const { t } = useTranslation();

  if (isFlowNodeData(data)) {
    const {
      label,
      config,
      properties,
      nodeId,
      registerGetValues,
      onSubmitNode,
      isRunning,
      errorNodeId,
    } = data;
    const displayLabel = label || t("Node");
    const provider = config?.provider || "-";
    const endpoint = config?.endpoint || "-";
    const method = config?.method || "POST";
    const fieldsCount = properties?.length ?? 0;
    const hasError = errorNodeId === nodeId;

    return (
      <div
        className="product-node flow-node"
        style={{
          background: "#fff",
          border: `1.5px solid ${hasError ? "#dc2626" : "#4f46e5"}`,
          borderRadius: "12px",
          minWidth: "375px",
          maxWidth: "375px",
          boxShadow: hasError
            ? "0 4px 24px rgba(220,38,38,0.25)"
            : "0 4px 24px rgba(79,70,229,0.25)",
          overflow: "hidden",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div className="flex flex-row gap-2 items-center p-2 border-b border-gray-200 border-dashed last:border-b-0">
          <div style={{ flex: 1, overflow: "hidden" }}>
            <div className="overflow-hidden text-sm font-bold whitespace-nowrap text-ellipsis">
              {displayLabel}
            </div>
            <div className="text-xs text-gray-500">
              {provider} · {method} · {fieldsCount} {t("trường")}
            </div>
          </div>
        </div>

        <PropertyComponent
          nodeId={nodeId}
          properties={properties}
          onSubmitNode={onSubmitNode}
          config={config}
          isRunning={isRunning}
          registerGetValues={registerGetValues}
        />

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

  return null;
});

/** Props cho form + nút submit của từng node */
interface PropertyComponentProps {
  nodeId: string;
  properties: Property[] | undefined;
  onSubmitNode?: (nodeId: string, fieldValues: NodeFieldValues) => void | Promise<void>;
  config?: NodeConfig;
  isRunning?: boolean;
  registerGetValues?: (nodeId: string, getValues: () => NodeFieldValues) => void;
}

/**
 * Form các field của node + nút Submit thủ công.
 * - Form dùng namePrefix="" để getValues() trả về { key: value } gửi lên API.
 * - registerGetValues: đăng ký getValues với parent để khi chạy auto parent gọi lấy giá trị.
 * - Submit: getValues() rồi gọi onSubmitNode (parent gọi API execute).
 */
const PropertyComponent = memo(function PropertyComponent({
  nodeId,
  properties,
  onSubmitNode,
  config,
  isRunning,
  registerGetValues,
}: PropertyComponentProps) {
  const { t } = useTranslation();

  return (
    <Form grid className="px-4 py-2">
      {properties?.length ? (
        <>
          {/* Đăng ký getValues với parent để chạy auto lấy được giá trị form */}
          {registerGetValues && <NodeFormRegister nodeId={nodeId} registerGetValues={registerGetValues} />}
          {properties.map((field, index) => (
            <Field
              key={field.key || index}
              namePrefix=""
              name={field.key}
              label={field.label}
              cols={12}
              required={field.required}
              tooltip={field.tooltip}
            >
              {field.type === PropertyTypeEnum.TEXT && (
                <Input clearable={field.clearable} placeholder={field.placeholder} />
              )}
              {field.type === PropertyTypeEnum.NUMBER && (
                <Input clearable={field.clearable} number placeholder={field.placeholder} />
              )}
              {field.type === PropertyTypeEnum.BOOLEAN && (
                <Switch placeholder={field.placeholder} />
              )}
              {(field.type === PropertyTypeEnum.SELECT ||
                field.type === PropertyTypeEnum.MULTI_SELECT) && (
                <Select
                  clearable={field.clearable}
                  multi={field.type === PropertyTypeEnum.MULTI_SELECT}
                  placeholder={field.placeholder}
                  menuPosition="absolute"
                  options={field?.options?.map((x) => ({
                    value: x.key,
                    label: x.label,
                  }))}
                />
              )}
              {field.type === PropertyTypeEnum.TEXTAREA && (
                <Textarea placeholder={field.placeholder} />
              )}
              {(field.type === PropertyTypeEnum.IMAGE ||
                field.type === PropertyTypeEnum.MUILTI_IMAGE) && (
                <ImageInput
                  multi={field.type === PropertyTypeEnum.MUILTI_IMAGE}
                  placeholder={field.placeholder}
                />
              )}
            </Field>
          ))}
          {/* Nút submit thủ công: lấy giá trị form và gọi API execute qua parent */}
          {onSubmitNode && config?.endpoint && (
            <NodeSubmitButton
              nodeId={nodeId}
              onSubmitNode={onSubmitNode}
              isRunning={isRunning}
            />
          )}
        </>
      ) : (
        <NotFound text={t("Chưa chọn trường")} />
      )}
    </Form>
  );
});

/**
 * Nút Submit trong form node: getValues() từ react-hook-form rồi gọi onSubmitNode.
 * Phải nằm trong Form để dùng useFormContext.
 */
function NodeSubmitButton({
  nodeId,
  onSubmitNode,
  isRunning,
}: {
  nodeId: string;
  onSubmitNode: (nodeId: string, fieldValues: NodeFieldValues) => void | Promise<void>;
  isRunning?: boolean;
}) {
  const { t } = useTranslation();
  const { getValues } = useFormContext() || {};

  const handleSubmit = useCallback(() => {
    if (!getValues || !onSubmitNode) return;
    const values = getValues() as NodeFieldValues;
    onSubmitNode(nodeId, values);
  }, [nodeId, onSubmitNode, getValues]);

  return (
    <div className="col-span-full flex justify-end pt-2">
      <Button
        icon={<GenerateAiIcon />}
        outline
        disabled={!!isRunning}
        onClick={(e) => {
          e.stopPropagation();
          handleSubmit();
        }}
        tooltip={t("Gửi thủ công node này (gọi API đã cấu hình)")}
        text={t("Submit")}
      />
    </div>
  );
}

/**
 * Thành phần nằm trong Form: đăng ký getValues với parent để khi chạy auto
 * parent gọi getValues() lấy giá trị form hiện tại của node.
 */
function NodeFormRegister({
  nodeId,
  registerGetValues,
}: {
  nodeId: string;
  registerGetValues: (nodeId: string, getValues: () => NodeFieldValues) => void;
}) {
  const { getValues } = useFormContext() || {};
  useEffect(() => {
    if (!getValues || !registerGetValues) return;
    registerGetValues(nodeId, () => (getValues() as NodeFieldValues) ?? {});
  }, [nodeId, registerGetValues, getValues]);
  return null;
}

ProductNodeHome.displayName = "ProductNodeHome";
