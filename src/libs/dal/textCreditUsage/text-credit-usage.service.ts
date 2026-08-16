import { CRUDService } from "../../../base/crudService";
import { TextCreditUsageModel } from "./text-credit-usage.model";

class TextCreditUsageService extends CRUDService(TextCreditUsageModel) {}

export const textCreditUsageService = new TextCreditUsageService();
