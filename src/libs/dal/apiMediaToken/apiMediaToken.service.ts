import { CRUDService } from "../../../base/crudService";
import { ApiMediaTokenModel } from "./apiMediaToken.model";

class ApiMediaTokenService extends CRUDService(ApiMediaTokenModel) {}

const apiMediaTokenService = new ApiMediaTokenService();
export { apiMediaTokenService };
