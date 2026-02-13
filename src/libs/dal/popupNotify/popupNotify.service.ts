import { CRUDService } from "../../../base/crudService";
import { PopupNotifyModel } from "./popupNotify.model";

class PopupNotifyService extends CRUDService(PopupNotifyModel) {}

const popupNotifyService = new PopupNotifyService();
export { popupNotifyService };
