import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface Authority extends BaseModel {
  name?: string; // Tên phân quyền
  scopes?: string[]; // Phạm vi phân quyền
  root?: boolean; // Phân quyền gốc
  parentIds?: string[]; // Phân quyền cha
  data?: AuthorityGroup[];
}
export interface AuthorityGroup {
  code?: string;
  name?: string;
  readOnly?: boolean;
  checked?: boolean;
  features?: AuthorityFeature[];
}
export interface AuthorityFeature {
  code?: string;
  name?: string;
  readOnly?: boolean;
  checked?: boolean;
  scopes?: AuthorityScope[];
}
export interface AuthorityScope {
  code?: string;
  name?: string;
  readOnly?: boolean;
  checked?: boolean;
}
export class AuthorityRepository extends CrudRepository<Authority> {
  apiName: string = "Authority";
  displayName: string = t("phân quyền");
  shortFragment: string = this.parseFragment(`
    id: String
    name: String
    root: Boolean
    parentIds: [ID]
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
    name: String
    scopes: [String]
    root: Boolean
    parentIds: [ID]
    data {
      code: String
      name: String
      readOnly: Boolean
      checked: Boolean
      features {
        code: String
        name: String
        readOnly: Boolean
        checked: Boolean
        scopes {
          code: String
          name: String
          checked: Boolean
          readOnly: Boolean
        }: [AuthorityScope]
      }: [AuthorityFeature]
    }: [AuthorifyGroup]
  `);
  async getAuthoritySelect() {
    return this.query({
      query: ` getAuthoritySelect`,
    }).then((res) => res.data.g0);
  }
}

export const AuthorityService = new AuthorityRepository();
