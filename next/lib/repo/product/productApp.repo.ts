import type { FlowNodeRun } from "../../flow-node/execute-client";
import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

// ─── Flow types (dùng bởi product-flow-page và useFlowNodeRunChanged) ─────────

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
  TEXT = "TEXT",
  SELECT = "SELECT",
  MULTI_SELECT = "MULTI_SELECT",  
  BOOLEAN = "BOOLEAN",
  NUMBER = "NUMBER",
  TEXTAREA = "TEXTAREA",
  IMAGE = "IMAGE",
  MUILTI_IMAGE = "MUILTI_IMAGE",
  FILE = "FILE",
  MEDIA = "MEDIA",
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
  outputType?: string;
  model?: string;
  baseUrl?: string;
  endpoint?: string;
  method?: string;
  headers?: string;
  bodyTemplate?: string;
  responsePath?: string;
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

// ─── ProductApp model (simplified – theo productApp.interface.ts) ─────────────

export interface ProductApp extends BaseModel {
  id?: string;
  name?: string;
  des?: string;
  coverImg?: string;
  categoryIds?: string[];
  active?: boolean;
  slug?: string;
  priority?: number;
  creditCost?: number;
  /** flow vẫn giữ để product-flow-page có thể đọc/ghi */
  flow?: ProductAppFlow;
  /** credit tổng toàn bộ node trong flow */
  creditCostTotal?: number;
}

// ─── Repository ───────────────────────────────────────────────────────────────

export class ProductAppRepository extends CrudRepository<ProductApp> {
  apiName: string = "ProductApp";
  displayName: string = t("sản phẩm app");
  shortFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    active
    slug
    creditCost
  `);
  fullFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    categoryIds
    active
    slug
    priority
    creditCost
  `);
  getDetailFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    des
    coverImg
    categoryIds
    active
    slug
    priority
    creditCost
  `);

  async getProductAppSlug(slug: string) {
    return await this.query({
      query: `getProductAppSlug(slug:"${slug}"){
        ${this.getDetailFragment}
      }`,
      options: { fetchPolicy: "no-cache" },
    }).then((res) => res.data.g0);
  }

  async getActiveProductApps(options?: any) {
    return await this.getAll({
      query: options || { limit: 20 },
      fragment: this.parseFragment(`
        id
        name
        coverImg
        slug
        creditCost
      `),
      apiName: "getActiveProductApps",
    });
  }

  async toggleActive(id: string) {
    return await this.mutate({
      mutation: `toggleActiveProductApp(id: "${id}") {
        ${this.shortFragment}
      }`,
    }).then((res) => res.data.g0);
  }

  /** Subscribe socket flowNodeRunChanged – khi run completed/failed backend bắn event */
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
