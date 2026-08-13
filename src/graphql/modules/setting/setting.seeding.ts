import path from "path";

import { walkSyncFiles } from "../../../helpers/common";
import logger from "../../../helpers/logger";
import { SettingModel } from "../../../libs/dal/setting";
import { SettingGroupModel } from "../../../libs/dal/settingGroup";
import { SettingResource } from "../../../libs/shared";

export default async function execute() {
  logger.debug('Running seeding "setting"');
  console.log("SettingGroupModel", SettingGroupModel);
  const settingGroups = await SettingGroupModel.find();
  const settings = await SettingModel.find();
  const configFiles = walkSyncFiles(path.join(__dirname, "configs"));
  const schemas: SettingResource.ConfigSchema[] = [];
  configFiles
    .filter((f: any) => /(.*).js$/.test(f))
    .map((f: any) => {
      try {
        const { default: schema } = require(f);
        if (schema?.slug && Array.isArray(schema.settings)) {
          schemas.push(schema);
        }
      } catch (err) {
        logger.error(`Không load được file cấu hình ${f}`, err);
      }
    });

  for (const group of schemas) {
    let settingGroup = settingGroups.find((g: any) => g.slug == group.slug);
    if (!settingGroup) {
      console.log("Bổ sung nhóm cấu hình ", group.name);
      settingGroup = await SettingGroupModel.create({
        slug: group.slug,
        name: group.name,
        desc: group.desc,
      });
    }
    for (const setting of group.settings) {
      let oldSetting = settings.find((s: any) => s.key == setting.key);
      if (!oldSetting) {
        console.log("Bổ sung cấu hình", setting.name);
        await SettingModel.create({
          ...setting,
          groupId: settingGroup._id.toString(),
        });
      } else {
        let changed = false;
        if (oldSetting.isPrivate !== setting.isPrivate) {
          console.log("Cập nhật isPrivate cho", setting.name);
          oldSetting.isPrivate = setting.isPrivate;
          changed = true;
        }
        if (setting.sort != null && oldSetting.sort !== setting.sort) {
          oldSetting.sort = setting.sort;
          changed = true;
        }
        if (changed) await oldSetting.save();
      }
    }
    await settingGroup.save();
  }
}
