import { BaseUsecase, UserCommand } from "../../core";
import { UserLoader } from "../../dal/user";

export namespace GetUserPublicInfo {
  export class Command extends UserCommand {}

  export class GetUserPublicInfoUsecase extends BaseUsecase {
    async execute(command: Command) {
      // find user by id
      const user = await UserLoader.load(command.userId);
      if (!user) {
        return null;
      }
      return {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        email: user.email,
      };
    }
  }

  export const usecase = new GetUserPublicInfoUsecase();
}
