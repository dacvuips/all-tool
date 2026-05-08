import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Trending extends BaseModel {
  name: string;
  imageUrls: string[];
  prompt: string;
  isActive: boolean;
  customerId: string;
  count: number;
  trendingCategoryIds: string[];
  price: number;
  isPublish: boolean;
  monthlyCount: number;
  des: string;
}

export class TrendingRepository extends CrudRepository<Trending> {
  apiName: string = "Trending";
  displayName: string = t("trending");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imageUrls: [String]
    prompt: String
    isActive: Boolean
    customerId: ID
    count: Int
    trendingCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    imageUrls: [String]
    prompt: String
    isActive: Boolean
    customerId: ID
    count: Int
    trendingCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
  `);
}

export const TrendingService = new TrendingRepository();
