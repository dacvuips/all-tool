import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";

export interface SelectCustomer extends BaseModel {
  name?: string; // Tên khách hàng

  avatarUrl?: string; // Ảnh đại diện
}
export class SelectCustomerRepository extends CrudRepository<SelectCustomer> {
  apiName: string = "SelectCustomer";
  displayName: string = t("tùy chọn khách hàng");
  shortFragment: string = this.parseFragment(`
    id
    name
    avatarUrl
  `);
  fullFragment: string = this.parseFragment(`
    id
    name 
    avatarUrl 
    
  `);
}

export const SelectCustomerService = new SelectCustomerRepository();
