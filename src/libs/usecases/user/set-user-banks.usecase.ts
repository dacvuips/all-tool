import { ForbiddenError } from "apollo-server-express";
import { IsNotEmpty } from "class-validator";
import _ from "lodash";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { UserCommand } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import { UserBanks, UserModel } from "../../dal/user";

export namespace SetUserBanks {
  export class Command extends UserCommand {
    @IsNotEmpty()
    banks: UserBanks[];
    @IsNotEmpty()
    updaterId: string;
  }

  class SetUserBanksUsecase {
    async execute(command: Command) {
      // find user by id
      let user = await UserModel.findById(command.userId).orFail(
        new ForbiddenError(t("Không tìm thấy tài khoản"))
      );
      // Lấy giá trị hiện tại và giá trị bị thay đổi
      const getChangedValues = (oldData: any, newData: any) => {
        const oldValueArray = [] as any[];
        const newValueArray = [] as any[];
        // Duyệt qua tất cả các trường của đối tượng mới

        _.map(newData, (newItem, newIndex) => {
          // console.log("newItem", newItem);

          // console.log("newItem", newItem);
          // console.log("oldItem", oldItem);

          _.forEach(newItem._doc, (value, key) => {
            const oldValue = _.get(oldData[newIndex], key); // Lấy giá trị của trường từ đối tượng cũ

            if (typeof value == "object") return;
            if (!_.isEqual(oldValue, value)) {
              oldValueArray.push(oldValue);
              newValueArray.push(value);
            }
          });
        });
        // console.log("oldData", oldValueArray);
        // console.log("newData", newValueArray);
        return { old: oldValueArray, new: newValueArray };
      };

      await UserModel.findOneAndUpdate(
        { _id: user._id },
        { $set: { banks: command.banks } },
        { new: true }
      ).then((res) => {
        const changes = getChangedValues(user.banks, res.banks);
        // Tạo thông báo
        const customerNotify = new NotificationBuilder(
          "Cập nhật tài khoản",
          `Bạn đã cập nhật tài khoản thành công, giá trị cũ:[ ${changes.old} ] | giá trị đổi: [ ${changes.new} ] `
        )
          .sendTo(NotificationTarget.USER, command.updaterId)
          .account()
          .build();
        InsertNotification([customerNotify]);
      });

      return { success: true };
    }
  }

  export const usecase = new SetUserBanksUsecase();
}
