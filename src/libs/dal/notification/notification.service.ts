import { CRUDService } from "../../../base/crudService";
import { NotificationModel } from "./notification.model";

class NotificationService extends CRUDService(NotificationModel) {}

const notificationService = new NotificationService();

export { notificationService };
