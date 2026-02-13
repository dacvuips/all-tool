import { CRUDService } from "../../../base/crudService";
import { counterService } from "../../../libs/dal/counter";
import { UserModel } from "./user.model";

class UserService extends CRUDService(UserModel) {
  async generateCode() {
    return await counterService.trigger("staff", 1000).then((count) => "MM" + count);
  }
}

const userService = new UserService();

export { userService };
