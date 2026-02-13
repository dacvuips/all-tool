import { CRUDService } from "../../../base/crudService";
import { AuthorityData } from "../../../libs/dal/authority/authorityData";
import { UserRoleEnum } from "../../../libs/shared";
import { UserModel } from "../user/user.model";
import { AuthorityStatus } from "./authority.interface";
import { AuthorityModel } from "./authority.model";

class AuthorityService extends CRUDService(AuthorityModel) {
  async seeding() {
    const rootAuthority = await AuthorityModel.findOne({ root: true });
    if (!rootAuthority) {
      console.log("Khởi tạo cấu hình phân quyền mặc định");
      const scopes: string[] = [];
      AuthorityData.forEach((g) =>
        g.features.forEach((f) =>
          f.scopes.forEach((scope) => {
            console.log("Khởi tạo phân quyền ", g.name, f.name, scope.name);
            scopes.push(scope.code);
          })
        )
      );
      await AuthorityModel.create({
        name: "Admin",
        root: true,
        parentIds: [],
        scopes: scopes,
        status: AuthorityStatus.ACTIVE,
      });
      await UserModel.updateMany({ role: UserRoleEnum.ADMIN }, { $set: { scopes } });
    } else {
      let hasUpdate = false;
      for (const g of AuthorityData) {
        for (const f of g.features) {
          for (const scope of f.scopes) {
            if (!rootAuthority.scopes.includes(scope.code)) {
              console.log("Khởi tạo phân quyền ", g.name, f.name, scope.name);
              rootAuthority.scopes.push(scope.code);
              hasUpdate = true;
            }
          }
        }
      }

      if (hasUpdate) {
        rootAuthority.markModified("scopes");
        await rootAuthority.save();
        await UserModel.updateMany(
          { role: UserRoleEnum.ADMIN },
          { $set: { scopes: rootAuthority.scopes } }
        );
      }
    }
  }
}

const authorityService = new AuthorityService();

export { authorityService };
