import { CRUDService } from "../../../base/crudService";
import { PaypalTransactionsModel } from "./paypalTransactions.model";

class PaypalTransactionsService extends CRUDService(PaypalTransactionsModel) {}

const paypalTransactionsService = new PaypalTransactionsService();
export { paypalTransactionsService };
