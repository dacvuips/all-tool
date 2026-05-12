import { CRUDService } from "../../../base/crudService";
import { TrendingCategoryModel } from "./trending-category.model";
class TrendingCategoryService extends CRUDService(TrendingCategoryModel) {}

const trendingCategoryService = new TrendingCategoryService();

export { trendingCategoryService };
