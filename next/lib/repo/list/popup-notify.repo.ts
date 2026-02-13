import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { PopupNotifyTypeEnum } from "../types";

export interface PopupNotify extends BaseModel {
  name?: string; // tên popup
  description?: string; // mô tả
  type?: PopupNotifyTypeEnum; // loại popup
  status?: string; // trạng thái
  data?: any; // dữ liệu
  startDate?: Date; // ngày bắt đầu
  endDate?: Date; // ngày kết thúc
  priority?: number; // ưu tiên
  action?: string; // hành động
  link?: string; // đường dẫn website
}
export class PopupNotifyRepository extends CrudRepository<PopupNotify> {
  apiName: string = "PopupNotify";
  displayName: string = t("thông báo");
  shortFragment: string = this.parseFragment(`
    id
    createdAt
    updatedAt

    name
    description
    type
    status
    data
    startDate
    endDate
    priority 
    action 
    link
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt
    updatedAt
  
    name
    description
    type
    status
    data
    startDate
    endDate
    priority 
    action 
    link
  `);
}

export const PopupNotifyService = new PopupNotifyRepository();
