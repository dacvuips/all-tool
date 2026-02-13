import { CRUDService } from "../../../base/crudService";
import { ThreadMessageModel } from "./threadMessage.model";

class ThreadMessageService extends CRUDService(ThreadMessageModel) {}

const threadMessageService = new ThreadMessageService();
export { threadMessageService };
