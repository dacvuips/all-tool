import { CRUDService } from "../../../base/crudService";
import { CustomerModel } from "./customer.model";
class CustomerService extends CRUDService(CustomerModel) {
  public CustomerGenerateCode = () => {
    function generateRandomString(length: number) {
      let result = "";
      while (result.length < length) {
        result += Math.random().toString(36).substring(2).toUpperCase();
      }
      return result.substring(0, length);
    }

    return "CUS" + "-" + generateRandomString(10);
  };
}

const customerService = new CustomerService();

export { customerService };
