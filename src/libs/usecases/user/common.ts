import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../core";
import { UserModel } from "../../dal/user";
import { UserRoleEnum } from "../../shared";

export async function findPartnerByIdAndValidate(userId: string) {
  const partner = await UserModel.findById(userId).orFail(
    new ForbiddenError(t(`Partner không tồn tại`))
  );

  // require user to be partner
  if (partner.role != UserRoleEnum.PARTNER) {
    throw new ForbiddenError(t(`Bạn không có quyền xử lý giao dịch này`));
  }
  return partner;
}
