import { CRUDService } from "../../../base/crudService";
import { BankModel } from "./bank.model";
class BankService extends CRUDService(BankModel) {}

const bankService = new BankService();

export { bankService };
