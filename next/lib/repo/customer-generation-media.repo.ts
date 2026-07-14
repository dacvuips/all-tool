import { t } from "../functions/i18n";
import { BaseModel, CrudRepository } from "./crud.repo";

export type CustomerMediaType = "image" | "video" | "file" | "audio";

export interface CustomerGenerationMedia extends BaseModel {
  customerId: string;
  productId: string;
  nodeId: string;
  runId: string;
  type: CustomerMediaType;
  attachmentId?: string;
  url?: string;
  mimeType?: string;
  size?: number;
  order?: number;
  /** request_id Flow2 — upsample ảnh 2K/4K hoặc video 1080p */
  flow2RequestId?: string;
}

export class CustomerGenerationMediaRepository extends CrudRepository<CustomerGenerationMedia> {
  apiName: string = "CustomerGenerationMedia";
  displayName: string = t("media");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    customerId: String
    productId: String
    nodeId: String
    runId: String
    type: String
    attachmentId: String
    url: String
    mimeType: String
    size: Int
    order: Int
    flow2RequestId: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    customerId: String
    productId: String
    nodeId: String
    runId: String
    type: String
    attachmentId: String
    url: String
    mimeType: String
    size: Int
    order: Int
    flow2RequestId: String
  `);
}

export const CustomerGenerationMediaService = new CustomerGenerationMediaRepository();
