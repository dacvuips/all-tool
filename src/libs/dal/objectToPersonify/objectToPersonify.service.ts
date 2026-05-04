import { CRUDService } from "../../../base/crudService";
import { ObjectToPersonifyModel } from "./objectToPersonify.model";
class ObjectToPersonifyService extends CRUDService(ObjectToPersonifyModel) {}

const objectToPersonifyService = new ObjectToPersonifyService();

export { objectToPersonifyService };
