import { Request } from "express";
import { Context } from "../../../libs/graphql";
import { CustomerModel, CustomerStatusEnum } from "../../../libs/dal/customer";
import { SettingModel } from "../../../libs/dal/setting";
import { authVoiceCustomer, isStandardPlusPlan } from "../voice/_access";

export { authVoiceCustomer as authFilmCustomer };

function deny(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

/** Film sản xuất: Customer ACTIVE, sàn không ngừng, gói Standard trở lên. */
export async function assertFilmFeatureAllowed(context: Context): Promise<void> {
  if (!context.isCustomer || !context.id) {
    deny("Sai luồng", 403);
  }

  const customer = await CustomerModel.findById(context.id)
    .select("status googlePackage.subscription")
    .lean();
  if (!customer) {
    deny("Sai luồng", 403);
  }

  if (customer.status !== CustomerStatusEnum.ACTIVE) {
    deny("Tài khoản bị khóa hoặc ngừng kích hoạt", 403);
  }

  const pageBlockSetting = await SettingModel.findOne({ key: "pa-b-page" })
    .select("isActive")
    .lean();
  if (pageBlockSetting?.isActive === true) {
    deny("Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!", 403);
  }

  if (!isStandardPlusPlan(customer.googlePackage?.subscription)) {
    deny(
      "Chức năng Film chỉ dành cho gói Standard trở lên. Vui lòng nâng cấp gói.",
      403
    );
  }
}

export async function authFilmFeature(req: Request): Promise<Context> {
  const context = authVoiceCustomer(req);
  await assertFilmFeatureAllowed(context);
  return context;
}
