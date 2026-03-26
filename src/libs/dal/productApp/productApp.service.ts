import { CRUDService } from "../../../base/crudService";
import { ProductAppModel } from "./productApp.model";

class ProductAppService extends CRUDService(ProductAppModel) {}

const productAppService = new ProductAppService();
export { productAppService };
