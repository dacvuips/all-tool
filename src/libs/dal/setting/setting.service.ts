import { CRUDService } from "../../../base/crudService";
import { SettingModel } from "./setting.model";
class SettingService extends CRUDService(SettingModel) {}

const settingService = new SettingService();

export { settingService };
