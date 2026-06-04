import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export enum TrendingTypeEnum {
  CHATBOT = "CHATBOT",
  FLOW_APP = "FLOW_APP",
  AI_STUDIO_APP = "AI_STUDIO_APP",
  PROMPT = "PROMPT",
}

export const TRENDING_TYPE_OPTIONS = [
  { value: TrendingTypeEnum.PROMPT, label: t("Prompt") },
  { value: TrendingTypeEnum.CHATBOT, label: t("Chatbot") },
];
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
  promptShort: string;
  type: TrendingTypeEnum;
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
    isActive: Boolean
    customerId: ID
    count: Int
    trendingCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
    promptShort: String
    prompt: String
    type: TrendingTypeEnum
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
    trendingCategoryIds: [ID]
    price: Float
    isPublish: Boolean
    monthlyCount: Int
    des: String
    promptShort: String
    prompt: String
    type: TrendingTypeEnum
  `);
}

export const TrendingService = new TrendingRepository();
