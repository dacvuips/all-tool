import { t } from "../../functions/i18n";
import { BaseModel, CrudRepository } from "../crud.repo";
import { PropertyTypeEnum } from "../types";
export type PropertySelectOption = {
  key: string; // key option
  label: string; // Nhãn hiển thị
};
export type CategoryConfig = {
  type?: PropertyTypeEnum; // Kiểu thuộc tính, SELECT
  key?: string; // Tên thuộc tính, "Thuộc tính"
  label?: string; // Nhãn hiển thị, "Thuộc tính"
  placeholder?: string; // Placeholder, "Chọn thuộc tính"
  tooltip?: string; // Tooltip, "Chọn thuộc tính"
  required?: boolean; // Bắt buộc, true
  clearable?: boolean; // Cho phép xóa, true
  options?: PropertySelectOption[]; // Danh sách option, [{ id: "1", label: "Kim" }]
};
export interface Category extends BaseModel {
  name?: string;
  priority?: number;
  active?: boolean;
  description?: string;
  properties?: CategoryConfig[];
}
export class CategoryRepository extends CrudRepository<Category> {
  apiName: string = "Category";
  displayName: string = t("Ngành hàng");
  shortFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
 
    name: String
    description: String
    priority: Int
    active: Boolean
    imgUrl: String
    
 
  `);
  fullFragment: string = this.parseFragment(`
    id: String
    createdAt: DateTime
    updatedAt: DateTime
 
    name: String
    description: String
    priority: Int
    active: Boolean
    imgUrl: String
    properties {
      type: String
      key: String
      label: String
      placeholder: String
      tooltip: String
      required: Boolean
      clearable: Boolean
      options {
        key: String
        label: String
      }
      default: Boolean
    }
  
  `);
  async getActiveCategories(options?: any) {
    return await this.getAll({
      query: options || { limit: 20 },
      fragment: this.parseFragment(`
        id
        name 
        imgUrl
        properties {
      type: String
      key: String
      label: String
      placeholder: String
      tooltip: String
      required: Boolean
      clearable: Boolean
      options {
        key: String
        label: String
      }
      default: Boolean
    }
      `),
      apiName: "getAllCategoryActive",
    });
  }
}

export const CategoryService = new CategoryRepository();
