import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Topic extends BaseModel {
  id: string;
  createdAt: string;
  updatedAt: string;
  name: string;
  slug: string;
  image: string;
  group: string;
  summary?: number;
}
export class TopicRepository extends CrudRepository<Topic> {
  apiName: string = "Topic";
  displayName: string = t("chủ đề");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    slug: String
    image: String
    group: String
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    slug: String
    image: String
    group: String
  `);
}
export const TopicService = new TopicRepository();
