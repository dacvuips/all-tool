import { CRUDService } from "../../../base/crudService";
import { ArtStyleCategoryModel } from "./art-style-category.model";
class ArtStyleCategoryService extends CRUDService(ArtStyleCategoryModel) {}

const artStyleCategoryService = new ArtStyleCategoryService();

export { artStyleCategoryService };
