import { CRUDService } from "../../../base/crudService";
import { ProductModel } from "./productApp.model";

class ProductAppService extends CRUDService(ProductModel) {}

const productAppService = new ProductAppService();
export { productAppService };
