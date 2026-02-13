import { CRUDService } from "../../../base/crudService";
import { WalletTransactionModel } from "./walletTransaction.model";

class WalletTransactionService extends CRUDService(WalletTransactionModel) {}

const walletTransactionService = new WalletTransactionService();
export { walletTransactionService };
