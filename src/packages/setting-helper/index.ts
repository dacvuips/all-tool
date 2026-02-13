import DataLoader from "dataloader";
import { ttlCache } from "../../helpers/ttlCache";
import { SettingModel } from "../../libs/dal/setting";
import { ISetting } from "../../libs/shared/interfaces/setting.interface";

export namespace SettingHelper {
  const SettingKeyLoader = new DataLoader<string, ISetting>(
    (keys: string[]) => {
      return SettingModel.find({ key: { $in: keys } }).then((settings) =>
        keys.map((k) => settings.find((s) => s.key == k)!)
      );
    },
    { cache: true, cacheMap: ttlCache({}) }
  );
  function getSettingValue(option: { secure: boolean }): (value: ISetting) => any {
    return (setting: ISetting) => {
      if (!setting) return;
      if (setting.isPrivate && option.secure) {
        return undefined;
      }
      return setting.value;
    };
  }
  export function load(key: string, option = { secure: false }) {
    return SettingKeyLoader.load(key).then(getSettingValue(option));
  }
  export function loadMany(keys: string[], option = { secure: false }) {
    return SettingKeyLoader.loadMany(keys).then((settings) =>
      settings.map(getSettingValue(option))
    );
  }
}
