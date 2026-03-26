import type { FlowNodeRun } from "../../flow-node/execute-client";
import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

/** Payload từ subscription flowNodeRunChanged (socket khi run completed/failed) */
export type FlowNodeRunChangeEvent = {
  runId: string;
  nodeId: string;
  customerId: string;
  productId: string;
  event: "completed" | "failed";
  data: FlowNodeRun;
};

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
}
export interface PropertySelectOption {
  key: string;
  label: string;
}

export interface Property {
  type?: PropertyTypeEnum;
  key?: string;
  label?: string;
  placeholder?: string;
  tooltip?: string;
  required?: boolean;
  clearable?: boolean;
  options?: PropertySelectOption[];
}

export interface NodeConfig {
  aiProviderKey?: AiProviderKeyEnum;
  endpoint?: string;
  method?: string;
  bodyTemplate?: string;
  /** Số credit trừ mỗi lần chạy node (0 = miễn phí). Hoàn nếu run FAILED. */
  creditCost?: number;
  creditCostLabel?: string;
}

export interface ProductAppFlowNodeData {
  label?: string;
  properties?: Property[];
  config?: NodeConfig;
}

export interface FlowNodePosition {
  x: number;
  y: number;
}

export interface ProductAppFlowNode {
  id: string;
  type?: string;
  position: FlowNodePosition;
  data: ProductAppFlowNodeData;
}

export interface ProductAppFlowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
}

export interface ProductAppFlow {
  nodes: ProductAppFlowNode[];
  edges: ProductAppFlowEdge[];
}

export interface ProductApp extends BaseModel {
  id?: string;
  name?: string;
  des?: string;
  video?: string;
  coverImg?: string;
  categoryIds?: string[];
  active?: boolean;
  slug?: string;
  price?: string;
  priority?: number;
  flow?: ProductAppFlow;
  creditCostTotal?: number;
}

export class ProductAppRepository extends CrudRepository<ProductApp> {
  apiName: string = "Product";
  displayName: string = t("sản phẩm");
  shortFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    video
    coverImg
    active
    slug
    creditCostTotal
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    video
    coverImg
    categoryIds
    active
    slug
    price
    priority
    creditCostTotal
    flow {
      nodes {
        id
        type
        position { x y }
        data {
          label
          properties {
            type
            key
            label
            placeholder
            tooltip
            required
            clearable
            options { key label }
          }
          config {
            aiProviderKey
            endpoint
            method
            model
            outputType
            bodyTemplate
            creditCost
            creditCostLabel
          }
        }
      }
      edges {
        id
        source
        target
        sourceHandle
        targetHandle
      }
    }
  `);
  getDetailFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    video
    coverImg
    categoryIds
    active
    slug
    price
    priority
    creditCostTotal
    flow {
      nodes {
        id
        type
        position { x y }
        data {
          label
          properties {
            type
            key
            label
            placeholder
            tooltip
            required
            clearable
            options { key label }
          }
          config {
            aiProviderKey
            endpoint
            method
            bodyTemplate
            creditCost
            creditCostLabel
          }
        }
      }
      edges {
        id
        source
        target
        sourceHandle
        targetHandle
      }
    }
  `);
  async getProductSlug(slug: string) {
    return await this.query({
      query: `getProductSlug(slug:"${slug}"){
        ${this.getDetailFragment}
      }`,
      options: { fetchPolicy: "no-cache" },
    }).then((res) => res.data.g0);
  }

  async getActiveProducts(options?: any) {
    return await this.getAll({
      query: options || { limit: 20 },
      fragment: this.parseFragment(`
        id
        name
        coverImg
        slug 
        creditCostTotal
      `),
      apiName: "getActiveProducts",
    });
  }

  async toggleActive(id: string) {
    return await this.mutate({
      mutation: `toggleActiveProduct(id: "${id}") {
        ${this.shortFragment}
      }`,
    }).then((res) => res.data.g0);
  }

  /** Subscribe socket flowNodeRunChanged – khi run completed/failed backend bắn event, cập nhật node realtime */
  subscribeFlowNodeRunChanged(params: { customerId: string; productId?: string }) {
    const { customerId, productId } = params;
    return this.subscribe({
      query: `flowNodeRunChanged(customerId: $customerId, productId: $productId) { runId nodeId customerId productId event data }`,
      variablesParams: "($customerId: String!, $productId: String)",
      options: { variables: { customerId, productId: productId ?? null } },
    }).map((res) => res.data.g0 as FlowNodeRunChangeEvent);
  }
}

export const ProductAppService = new ProductAppRepository();
