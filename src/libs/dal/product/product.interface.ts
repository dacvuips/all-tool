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
  MEDIA = "MEDIA", // Media
}

export enum AiProviderKeyEnum {
  OPENAI_KEY = "OPENAI_KEY",
  CLAUDE_KEY = "CLAUDE_KEY",
  GOOGLE_GEMINI_KEY = "GOOGLE_GEMINI_KEY",
  DEEP_SEEK_KEY = "DEEP_SEEK_KEY",
  KLING_KEY = "KLING_KEY",
  SEE_DANCE_KEY = "SEE_DANCE_KEY",
  GOOGLE_LABS_API_KEY = "GOOGLE_LABS_API_KEY",
  /** Film / Flow2 ChatGPT gateway — JSON { endpoint, apiKey, model } */
  CHATGPT_GATEWAY_KEY = "CHATGPT_GATEWAY_KEY",
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

/** Loại output từ API (ảnh, video, file) */
export enum ApiOutputTypeEnum {
  IMAGE = "IMAGE",
  VIDEO = "VIDEO",
  FILE = "FILE",
  AUDIO = "AUDIO",
}

export type ApiOutputType = ApiOutputTypeEnum;

/** Cấu hình API cho node - gọi API tạo ảnh/video/file từ các nền tảng AI */
export type NodeConfig = {
  /** Loại output: ảnh, video, file, audio */
  outputType?: ApiOutputType;
  /** Provider/nền tảng: openai, google, replicate, runway, stability, custom... */
  aiProviderKey?: AiProviderKeyEnum;
  /** Model: dall-e-3, veo3, flux, ... (phụ thuộc provider + outputType) */
  model?: string;
  /** Base URL (optional, override cho custom API) */
  baseUrl?: string;
  endpoint?: string;
  method?: string;
  /** Header bổ sung (JSON string hoặc key-value) */
  headers?: string;
  bodyTemplate?: string;
  /** Đường dẫn lấy URL kết quả từ response, VD: data.url, result.media[0].url */
  responsePath?: string;
  /** Số credit trừ cho mỗi lần chạy node (0 = miễn phí). Trừ khi run chuyển PROCESSING, hoàn nếu FAILED. */
  creditCost?: number;
  /** Nhãn hiển thị cho credit (vd: "2 credits/lần") */
  creditCostLabel?: string;
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
  categoryIds?: string[]; // Nhiều danh mục để hiển thị (click categoryId bên ngoài)
  active?: boolean;
  slug?: string;
  price?: number;
  priority?: number; // Độ ưu tiên hiển thị
  /** ReactFlow: nodes và edges trong 1 product */
  flow?: ProductFlow;
  creditCostTotal?: number;
};
