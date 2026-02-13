import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface SelectUser extends BaseModel {
  name: string;
  avatar: string;
}

export class SelectUserRepository extends CrudRepository<SelectUser> {
  apiName: string = "SelectUser";
  displayName: string = t("tùy chọn tài khoản");
  shortFragment: string = this.parseFragment(`
    id 
    name 
    avatar 
  `);
  fullFragment: string = this.parseFragment(`
  id 
  name 
  avatar 
  `);

  // for firebase
}

export const SelectUserService = new SelectUserRepository();
