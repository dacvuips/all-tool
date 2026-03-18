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
  `);
}

export const CustomerGenerationMediaService = new CustomerGenerationMediaRepository();
