import _ from "lodash";
import { BaseCommand, BaseUsecase } from "../../core";
import { SettingModel } from "../../dal/setting";

export namespace GetSettingNotPrivate {
  export class Command extends BaseCommand {}

  class GetSettingNotPrivateUsecase extends BaseUsecase {
    async execute() {
      const setting = await SettingModel.find({
        $and: [{ isPrivate: false, isSecret: false, isActive: true }],
      }).select("key value");
      return setting;
    }
  }

  export const usecase = new GetSettingNotPrivateUsecase();
}
