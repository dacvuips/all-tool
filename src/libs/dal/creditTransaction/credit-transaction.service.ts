import { CRUDService } from "../../../base/crudService";
import { CreditTransactionModel } from "./credit-transaction.model";

class CreditTransactionService extends CRUDService(CreditTransactionModel) {}

export const creditTransactionService = new CreditTransactionService();
