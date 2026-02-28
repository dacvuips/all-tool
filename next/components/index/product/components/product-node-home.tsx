import { memo } from "react";
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
  onSubmitNode: (nodeId: string, data: any) => void;
};

export type ProductNodeData = ProductCardNodeData | FlowNodeData;

function isFlowNodeData(data: ProductNodeData): data is FlowNodeData {
  return "nodeId" in data && !("product" in data);
}

export const ProductNodeHome = memo(({ data }: NodeProps<ProductNodeData>) => {
  const { t } = useTranslation();

  // Flow node: hiển thị theo node data (label, config, properties)
  if (isFlowNodeData(data)) {
    const { label, config, properties, nodeId, onSubmitNode } = data;
    const displayLabel = label || t("Node");
    const provider = config?.provider || "-";
    const endpoint = config?.endpoint || "-";
    const method = config?.method || "POST";
    const fieldsCount = properties?.length ?? 0;

    return (
      <div
        className="product-node flow-node"
        style={{
          background: "#fff",
          border: "1.5px solid #4f46e5",
          borderRadius: "12px",
          minWidth: "375  px",
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
            <div className="text-xs text-gray-500">
              {provider} · {method} · {fieldsCount} {t("trường")}
            </div>
          </div>
        </div>
        <PropertyComponent properties={properties} />

        <div className="p-2">
          <div className="flex flex-row gap-2 justify-end">
            {onSubmitNode && (
              <Button
                icon={<GenerateAiIcon />}
                onClick={(e) => {
                  e.stopPropagation();
                  onSubmitNode(nodeId, {});
                }}
                outline
                tooltip={t("Tạo dữ liệu với AI")}
                text={t("Tạo AI")}
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

const PropertyComponent = ({ properties }: { properties: Property[] }) => {
  const { t } = useTranslation();

  return (
    <Form grid className="px-4 py-2">
      {properties?.length ? (
        <>
          {properties?.map((field, index) => {
            return (
              <Field
                namePrefix="categoryProperties"
                key={field.key || index}
                name={field.key}
                label={field.label}
                cols={12}
                required={field.required}
                tooltip={field.tooltip}
              >
                {field.type == PropertyTypeEnum.TEXT && (
                  <Input clearable={field.clearable} placeholder={field.placeholder} />
                )}
                {field.type == PropertyTypeEnum.NUMBER && (
                  <Input clearable={field.clearable} number placeholder={field.placeholder} />
                )}
                {field.type == PropertyTypeEnum.BOOLEAN && (
                  <Switch placeholder={field.placeholder} />
                )}
                {(field.type == PropertyTypeEnum.SELECT ||
                  field.type == PropertyTypeEnum.MULTI_SELECT) && (
                  <Select
                    clearable={field.clearable}
                    multi={field.type == PropertyTypeEnum.MULTI_SELECT}
                    placeholder={field.placeholder}
                    menuPosition="absolute"
                    options={field?.options?.map((x) => ({
                      value: x.key,
                      label: x.label,
                    }))}
                  />
                )}

                {field.type == PropertyTypeEnum.TEXTAREA && (
                  <Textarea placeholder={field.placeholder} />
                )}
                {(field.type == PropertyTypeEnum.IMAGE ||
                  field.type == PropertyTypeEnum.MUILTI_IMAGE) && (
                  <ImageInput
                    multi={field.type == PropertyTypeEnum.MUILTI_IMAGE}
                    placeholder={field.placeholder}
                  />
                )}
              </Field>
            );
          })}
        </>
      ) : (
        <NotFound text={t("Chưa chọn trường")} />
      )}
    </Form>
  );
};

ProductNodeHome.displayName = "ProductNodeHome";
