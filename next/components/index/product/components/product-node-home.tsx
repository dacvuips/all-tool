import { memo, useCallback, useEffect, useMemo } from "react";
import { useFormContext } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { BsCashCoin } from "react-icons/bs";
import { Handle, NodeProps, Position } from "reactflow";
import type { FlowNodeRun, GenerationOutputRef } from "../../../../lib/flow-node/execute-client";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import {
  NodeConfig,
  Product,
  ProductFlowNodeData,
  Property,
  PropertyTypeEnum,
} from "../../../../lib/repo/product";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import {
  Button,
  Field,
  Form,
  ImageInput,
  Input,
  MediaInput,
  Select,
  Switch,
  Textarea,
} from "../../../shared/utilities/form";
import { Img, NotFound } from "../../../shared/utilities/misc";

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
  /** Kết quả run mới nhất (ảnh/video) sau khi job trả về – dùng để hiển thị trong node */
  latestRun?: FlowNodeRun | null;
};

export type ProductNodeData = ProductCardNodeData | FlowNodeData;

function isFlowNodeData(data: ProductNodeData): data is FlowNodeData {
  return "nodeId" in data && !("product" in data);
}

/** Fetches provider by id and renders flow node content (sync component, async inside) */
function FlowNodeContent({ data }: { data: FlowNodeData }) {
  const { t } = useTranslation();
  const { customer } = useAuth();

  const aiProviderKey = data.config?.aiProviderKey;
  const { CREDENTIAL_KEY_OPTIONS } = useOptionsTranslation();
  const aiProvider = useMemo(
    () => CREDENTIAL_KEY_OPTIONS.find((item) => item.value === aiProviderKey),
    [aiProviderKey, CREDENTIAL_KEY_OPTIONS]
  );
  const creditBalance = customer?.creditBalance;

  const {
    label,
    config,
    properties,
    nodeId,
    registerGetValues,
    onSubmitNode,
    isRunning,
    errorNodeId,
    latestRun,
  } = data;
  const displayLabel = label || t("Node");

  const hasError = errorNodeId === nodeId;
  const aiProviderName = aiProvider?.label ?? "-";
  const aiProviderImage = aiProvider?.image ?? "-";

  return (
    <div
      className="product-node flow-node nodrag nopan"
      style={{
        background: "#fff",
        border: `1.5px solid ${hasError ? "#dc2626" : "#4f46e5"}`,
        borderRadius: "12px",
        minWidth: "375px",
        maxWidth: "375px",
        boxShadow: hasError ? "0 4px 24px rgba(220,38,38,0.25)" : "0 4px 24px rgba(79,70,229,0.25)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      <div className="flex flex-row gap-2 items-center p-2 border-b border-gray-200 border-dashed last:border-b-0">
        <div style={{ flex: 1, overflow: "hidden" }}>
          <div className="overflow-hidden text-sm font-bold whitespace-nowrap text-ellipsis">
            {displayLabel}
          </div>
          <div className="flex flex-row gap-2 justify-between items-center">
            <div className="flex gap-1 items-center text-xs text-gray-500">
              <img src={aiProviderImage} alt={aiProviderName} className="px-1 h-5 rounded-full" />
              {aiProviderName}
            </div>

            <div className="flex gap-1 items-center text-xs text-primary">
              <BsCashCoin />
              {config?.creditCost > 0 ? config?.creditCost + " " + t("Credit") : t("Miễn phí")}
            </div>
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
        latestRun={latestRun}
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

export const ProductNodeHome = memo(function ProductNodeHome({ data }: NodeProps<ProductNodeData>) {
  if (isFlowNodeData(data)) {
    return <FlowNodeContent data={data} />;
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
  latestRun?: FlowNodeRun | null;
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
  latestRun,
}: PropertyComponentProps) {
  const { t } = useTranslation();
  const resultRefs = latestRun?.resultRefs;
  const hasResults = resultRefs && resultRefs.length > 0;

  return (
    <Form grid className="px-4 py-2">
      {properties?.length ? (
        <>
          {/* Đăng ký getValues với parent để chạy auto lấy được giá trị form */}
          {registerGetValues && (
            <NodeFormRegister nodeId={nodeId} registerGetValues={registerGetValues} />
          )}
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
                  className="nodrag"
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
              {field.type === PropertyTypeEnum.MEDIA && (
                <MediaInput placeholder={field.placeholder} />
              )}
            </Field>
          ))}
          {/* Nút submit thủ công: lấy giá trị form và gọi API execute qua parent */}
          {onSubmitNode && config?.endpoint && (
            <NodeSubmitButton nodeId={nodeId} onSubmitNode={onSubmitNode} isRunning={isRunning} />
          )}
          {/* Kết quả run (ảnh/video) hiển thị ngay trong node khi job đã xong */}
          {hasResults && <NodeResultOutput resultRefs={resultRefs} runStatus={latestRun?.status} />}
          {latestRun?.status === "FAILED" && latestRun?.errorMessage && (
            <p className="col-span-full mt-1 text-xs text-red-600">{latestRun.errorMessage}</p>
          )}
        </>
      ) : (
        <NotFound text={t("Chưa   chọn trường")} />
      )}
    </Form>
  );
});

/**
 * Hiển thị kết quả run (ảnh/video) ngay trong node khi job đã COMPLETED.
 */
function NodeResultOutput({
  resultRefs,
  runStatus,
}: {
  resultRefs: GenerationOutputRef[];
  runStatus?: string;
}) {
  const { t } = useTranslation();
  const sorted = [...resultRefs].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <div className="col-span-full pt-2 mt-2 border-t border-gray-200 border-dashed">
      <div className="text-xs font-medium text-gray-500 mb-1.5">{t("Kết quả")}</div>
      <div className="flex flex-wrap gap-2">
        {sorted.map((ref, idx) => (
          <div key={idx} className="flex flex-col items-center">
            {ref.type === "image" && ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block overflow-hidden rounded border border-gray-200"
              >
                <Img src={ref.url} alt="" className="object-cover w-16 h-16" />
              </a>
            )}
            {ref.type === "video" && ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs font-medium text-primary"
              >
                {t("Xem video")}
              </a>
            )}
            {(ref.type === "file" || ref.type === "audio") && ref.url && (
              <a
                href={ref.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary"
              >
                {ref.type === "audio" ? t("Nghe") : t("Tải file")}
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

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
    <div className="flex col-span-full gap-2 justify-end items-center pt-2">
      <Button
        icon={<GenerateAiIcon />}
        outline
        onClick={(e) => {
          e.stopPropagation();
          handleSubmit();
        }}
        tooltip={t("Gửi thủ công node này (gọi API đã cấu hình)")}
        text={t("Generate AI ")}
        disabled={!!isRunning}
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
