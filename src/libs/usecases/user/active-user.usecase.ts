import { IsNotEmpty } from "class-validator";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, ForbiddenError, UserCommand } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import { UserModel, UserStatus } from "../../dal/user";

export namespace ActiveUser {
  export class Command extends UserCommand {
    @IsNotEmpty()
    updaterId: string;
  }
  export class ActiveUserUsecase extends BaseUsecase {
    async execute(command: Command) {
      // find user by id
      const user = await UserModel.findById(command.userId).orFail(
        new ForbiddenError(t("Không tìm thấy tài khoản"))
      );
      const newUser = await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            status: UserStatus.ACTIVE,
          },
        }
      ).then(() => {
        // Tạo thông báo
        const customerNotify = new NotificationBuilder(
          "Kích hoạt tài khoản",
          `Bạn đã kích hoạt tài khoản thành công, Tên tài khoản: ${user.name}`
        )
          .sendTo(NotificationTarget.USER, command.updaterId)
          .account()
          .build();
        InsertNotification([customerNotify]);
      });
      return {
        success: true,
      };
    }
  }
  export const usecase = new ActiveUserUsecase();
}
