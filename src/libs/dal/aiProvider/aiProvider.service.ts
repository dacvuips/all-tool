import { CRUDService } from "../../../base/crudService";
import { AiProviderModel } from "./aiProvider.model";

class AiProviderService extends CRUDService(AiProviderModel) {}

const aiProviderService = new AiProviderService();
export { aiProviderService };
