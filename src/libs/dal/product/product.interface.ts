import { TimestampEntity } from "../../core";

export enum PropertyTypeEnum {
  TEXT = "TEXT", // Text
  SELECT = "SELECT", // Select
  MULTI_SELECT = "MULTI_SELECT", // Multi select
  BOOLEAN = "BOOLEAN", // Boolean
  NUMBER = "NUMBER", // Number
  TEXTAREA = "TEXTAREA", // Textarea
  IMAGE = "IMAGE", // Image
  MUILTI_IMAGE = "MUILTI_IMAGE", // nhiều ảnh
  FILE = "FILE", // File
}

export type PropertySelectOption = {
  key: string; // Id option
  label: string; // Nhãn hiển thị
};

export type Property = {
  type?: PropertyTypeEnum; // Kiểu thuộc tính, SELECT
  key?: string; // Tên thuộc tính, "Thuộc tính"
  label?: string; // Nhãn hiển thị, "Thuộc tính"
  placeholder?: string; // Placeholder, "Chọn thuộc tính"
  tooltip?: string; // Tooltip, "Chọn thuộc tính"
  required?: boolean; // Bắt buộc, true
  clearable?: boolean; // Cho phép xóa, true
  options?: PropertySelectOption[]; // Danh sách option, [{ id: "1", label: "Kim" }]
};

/** Cấu hình API cho node (provider, endpoint, method, bodyTemplate) */
export type NodeConfig = {
  provider?: string;
  endpoint?: string;
  method?: string;
  bodyTemplate?: string;
};

/** Data lưu trong mỗi node ReactFlow */
export type ProductFlowNodeData = {
  /** Tên hiển thị của node */
  label?: string;
  /** Thuộc tính form (inputs) của node */
  properties?: Property[];
  /** Cấu hình gọi API */
  config?: NodeConfig;
};

/** Vị trí node trên canvas */
export type FlowNodePosition = {
  x: number;
  y: number;
};

/** Một node trong flow (theo cấu trúc ReactFlow) */
export type ProductFlowNode = {
  id: string;
  type?: string;
  position: FlowNodePosition;
  data: ProductFlowNodeData;
};

/** Một edge trong flow (theo cấu trúc ReactFlow) */
export type ProductFlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
};

/** Toàn bộ flow (nodes + edges) lưu trong 1 product */
export type ProductFlow = {
  nodes: ProductFlowNode[];
  edges: ProductFlowEdge[];
};

export type IProduct = TimestampEntity & {
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  categoryId?: string;
  active?: boolean;
  slug?: string;
  price?: number;
  priority?: number; // Độ ưu tiên hiển thị
  /** ReactFlow: nodes và edges trong 1 product */
  flow?: ProductFlow;
};
