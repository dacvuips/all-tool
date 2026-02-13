import { CRUDService } from "../../../base/crudService";
import { SettingGroupModel } from "./settingGroup.model";

class SettingGroupService extends CRUDService(SettingGroupModel) {}

const settingGroupService = new SettingGroupService();

export { settingGroupService };
