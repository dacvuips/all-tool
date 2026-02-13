import { NotificationModel } from "../../../libs/dal/notification";
import { CRUDService } from "../../../base/crudService";
class NotificationService extends CRUDService(NotificationModel) {}

const notificationService = new NotificationService();

export { notificationService };
