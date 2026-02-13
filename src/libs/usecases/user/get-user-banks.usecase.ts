import { ForbiddenError } from "apollo-server-express";
import { IsNotEmpty } from "class-validator";
import { t } from "../../../helpers/functions/string";
import { UserCommand } from "../../core";
import { UserModel } from "../../dal/user";

export namespace GetUserBanks {
  export class Command extends UserCommand {
    @IsNotEmpty()
    userId: string;
  }

  class GetUserBanksUsecase {
    async execute(command: Command) {
      // find user by id
      let user = await UserModel.findById(command.userId).orFail(
        new ForbiddenError(t("Không tìm thấy tài khoản"))
      );

      return { banks: user.banks };
    }
  }

  export const usecase = new GetUserBanksUsecase();
}
