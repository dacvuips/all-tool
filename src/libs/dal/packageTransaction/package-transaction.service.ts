import { CRUDService } from "../../../base/crudService";
import { PackageTransactionModel } from "./package-transaction.model";

class PackageTransactionService extends CRUDService(PackageTransactionModel) {}

export const packageTransactionService = new PackageTransactionService();
