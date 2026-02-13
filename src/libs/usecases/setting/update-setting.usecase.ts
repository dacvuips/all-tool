import { IsNotEmpty } from "class-validator";
import _ from "lodash";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import cache from "../../../helpers/cache";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseUsecase, UserCommand } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import { settingService } from "../../dal/setting";

export namespace UpdateSetting {
  export class Command extends UserCommand {
    @IsObjectId()
    settingId: string;

    @IsNotEmpty()
    data: any;
  }

  class UpdateSettingUsecase extends BaseUsecase {
    async execute(cmd: Command): Promise<any> {
      const { settingId, data } = cmd;
      const setting = await settingService.findOne({ _id: settingId });
      const updated = await settingService.updateOne(settingId, data);
      // Lấy giá trị hiện tại và giá trị bị thay đổi
      const getChangedValues = (oldData: any, newData: any) => {
        const oldValueArray = [] as any[];
        const newValueArray = [] as any[];

        if (!_.isEqual(oldData, newData)) {
          oldValueArray.push(JSON.stringify(oldData));
          newValueArray.push(JSON.stringify(newData));
        }
        return { old: oldValueArray, new: newValueArray };
      };
      // handle cache
      switch (updated.key) {
        case "pa-b-page":
          // clear customer token
          await cache.delByPattern("token-session:customer:*");
          await cache.delByPattern("token-session:shop:*");
          break;
      }

      const changes = getChangedValues(setting.value, updated.value);
      // Tạo thông báo
      const customerNotify = new NotificationBuilder(
        "Cập nhật cấu hình sàn",
        `Bạn đã cập nhật cấu hình ${setting.name}, Giá trị cũ: [ ${changes.old} ] | Giá trị mới: [ ${changes.new} ]`
      )
        .sendTo(NotificationTarget.USER, cmd.userId)
        .setting()
        .build();
      InsertNotification([customerNotify]);
      return updated;
    }
  }

  export const usecase = new UpdateSettingUsecase();
}
