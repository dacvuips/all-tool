import { CRUDService } from "../../../base/crudService";
import { CategoryModel } from "./category.model";

class CategoryService extends CRUDService(CategoryModel) {}

const categoryService = new CategoryService();
export { categoryService };
