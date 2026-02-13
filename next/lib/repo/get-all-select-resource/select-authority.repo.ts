import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface SelectAuthority extends BaseModel {
  name?: string; // Tên phân quyền
}

export class SelectAuthorityRepository extends CrudRepository<SelectAuthority> {
  apiName: string = "SelectAuthority";
  displayName: string = t("tùy chọn phân quyền");
  shortFragment: string = this.parseFragment(`
    id
    name 
  `);
  fullFragment: string = this.parseFragment(`
    id 
    name 
    
  `);
}

export const SelectAuthorityService = new SelectAuthorityRepository();
