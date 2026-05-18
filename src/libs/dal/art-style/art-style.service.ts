import { CRUDService } from "../../../base/crudService";
import { ArtStyleModel } from "./art-style.model";
class ArtStyleService extends CRUDService(ArtStyleModel) {}

const artStyleService = new ArtStyleService();

export { artStyleService };
