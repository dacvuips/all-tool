import { IsNotEmpty } from "class-validator";
import { NotificationBuilder } from "../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../helpers/functions/string";
import { BaseUsecase, ForbiddenError, UserCommand } from "../../core";
import { InsertNotification, NotificationTarget } from "../../dal/notification";
import { UserModel, UserStatus } from "../../dal/user";

export namespace BlockUser {
  export class Command extends UserCommand {
    @IsNotEmpty()
    updaterId: string;
  }
  export class BlockUserUsecase extends BaseUsecase {
    async execute(command: Command) {
      // find user by id
      const user = await UserModel.findById(command.userId).orFail(
        new ForbiddenError(t("Không tìm thấy tài khoản"))
      );
      await UserModel.updateOne(
        { _id: user._id },
        {
          $set: {
            status: UserStatus.BLOCKED,
          },
        }
      ).then(() => {
        // Tạo thông báo
        const customerNotify = new NotificationBuilder(
          "Khóa tài khoản",
          `Bạn đã khóa tài khoản thành công, Tên tài khoản: ${user.name}`
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
  export const usecase = new BlockUserUsecase();
}
