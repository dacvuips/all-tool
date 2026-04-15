import { CRUDService } from "../../../base/crudService";
import { IntroduceModel } from "./introduce.model";

class IntroduceService extends CRUDService(IntroduceModel) {}

export const introduceService = new IntroduceService();
