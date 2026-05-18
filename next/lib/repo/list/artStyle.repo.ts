import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface ArtStyle extends BaseModel {
  name: string;
  imageUrls: string[];
  prompt: string;
  isActive: boolean;
  customerId: string;
  count: number;
  artStyleCategoryIds: string[];
  price: number;
  isPublish: boolean;
  monthlyCount: number;
  des: string;
  promptShort: string;
}

export class ArtStyleRepository extends CrudRepository<ArtStyle> {
  apiName: string = "ArtStyle";
  displayName: string = t("art style");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imageUrls: [String] 
    isActive: Boolean
    customerId: ID
    count: Int
    artStyleCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
    promptShort: String
    prompt: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imageUrls: [String] 
    isActive: Boolean
    customerId: ID
    count: Int
    artStyleCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
    promptShort: String
    prompt: String
  `);
}

export const ArtStyleService = new ArtStyleRepository();
