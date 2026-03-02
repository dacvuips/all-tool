import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export enum AiProviderKeyEnum {
  OPENAI_KEY = "OPENAI_KEY",
  CLAUDE_KEY = "CLAUDE_KEY",
  GOOGLE_GEMINI_KEY = "GOOGLE_GEMINI_KEY",
  DEEP_SEEK_KEY = "DEEP_SEEK_KEY",
  KLING_KEY = "KLING_KEY",
  SEE_DANCE_KEY = "SEE_DANCE_KEY",
}
export interface AiProvider extends BaseModel {
  name?: string;
  imgUrl?: string;
  website?: string;
  active?: boolean;
  key?: string;
}

export class AiProviderRepository extends CrudRepository<AiProvider> {
  apiName: string = "AiProvider";
  displayName: string = t("nhà cung cấp AI");

  shortFragment: string = this.parseFragment(`
    id: String
    name: String
    imgUrl: String
    website: String
    active: Boolean
    key: String
    createdAt: DateTime
    updatedAt: DateTime
  `);

  fullFragment: string = this.parseFragment(`
    id: String
    name: String
    imgUrl: String
    website: String
    active: Boolean
    key: String
    createdAt: DateTime
    updatedAt: DateTime
  `);
  async getAiProviderSelect() {
    return await this.query({
      query: `getAiProviderSelect`,
    }).then((res) => res.data.g0);
  }
}

export const AiProviderService = new AiProviderRepository();
