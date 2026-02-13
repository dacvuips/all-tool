import { CRUDService } from "../../../base/crudService";
import { ProductModel } from "./product.model";

class ProductService extends CRUDService(ProductModel) {}

const productService = new ProductService();
export { productService };
