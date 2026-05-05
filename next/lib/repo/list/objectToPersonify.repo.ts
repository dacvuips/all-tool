import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface ObjectToPersonify extends BaseModel {
  name: string;
  prompt: string;
  imageUrl: string;
  code: string;
  isActive: boolean;
  customerId: string;
}

export class ObjectToPersonifyRepository extends CrudRepository<ObjectToPersonify> {
  apiName: string = "ObjectToPersonify";
  displayName: string = t("nhân vật nhân hoá");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    prompt: String
    imageUrl: String
    code: String
    isActive: Boolean
    customerId: ID
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    prompt: String
    imageUrl: String
    code: String
    isActive: Boolean
    customerId: ID
  `);
}

export const ObjectToPersonifyService = new ObjectToPersonifyRepository();
