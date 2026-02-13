import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Banner extends BaseModel {
  image: string;
  title: string;
  subtitle: string;
  actionType: BannerActionType;
  link: string;
  productId: string;
  voucherId: string;
  isPublic: boolean;
  priority: number;
  memberId: string;
  position: string;
}
export class BannerRepository extends CrudRepository<Banner> {
  apiName: string = "Banner";
  displayName: string = t("banner");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    image: String
    title: String
    subtitle: String
    actionType: String
    link: String
    isPublic: Boolean
    priority: Int
    position: String

  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    image: String
    title: String
    subtitle: String
    actionType: String
    link: String
    isPublic: Boolean
    priority: Int
    position: String
   
  `);
}

export const BannerService = new BannerRepository();

export type BannerActionType = "NORMAL" | "WEBSITE";
