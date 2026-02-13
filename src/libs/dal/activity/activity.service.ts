import { CRUDService } from "../../../base/crudService";
import { ActivityModel } from "./activity.model";
class ActivityService extends CRUDService(ActivityModel) {}

const activityService = new ActivityService();

export { activityService };
