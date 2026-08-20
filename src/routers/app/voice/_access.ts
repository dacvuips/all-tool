import { Request } from "express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { Context } from "../../../libs/graphql";
import { CustomerModel, CustomerStatusEnum, SubscriptionPlanEnum } from "../../../libs/dal/customer";
import { SettingModel } from "../../../libs/dal/setting";

const STANDARD_PLUS_PLANS = new Set<string>([
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.ENTERPRISE,
]);

export function isStandardPlusPlan(subscription?: string | null): boolean {
  return !!subscription && STANDARD_PLUS_PLANS.has(String(subscription).trim().toLowerCase());
}

function deny(message: string, statusCode: number): never {
  throw Object.assign(new Error(message), { statusCode });
}

function customerFromContext(context: Context): string {
  if (!context.isCustomer || !context.id) {
    deny("Sai luồng", 403);
  }
  return context.id;
}

/** Đăng nhập + Customer trong context. Dùng cho API danh sách voice (không cần gói). */
export function authVoiceCustomer(req: Request): Context {
  const context = new Context({ req });
  context.auth(TOKEN_ROLES.ADMIN_STAFF_PARTNER_SHOP_CUSTOMER_SHOP_STAFF);
  customerFromContext(context);
  return context;
}

/** Tạo giọng: Customer lấy từ context, đang ACTIVE, sàn không ngừng, gói Standard trở lên. */
export async function assertVoiceGenerationAllowed(context: Context): Promise<void> {
  const customerId = customerFromContext(context);

  const customer = await CustomerModel.findById(customerId)
    .select("status googlePackage.subscription")
    .lean();
  if (!customer) {
    deny("Sai luồng", 403);
  }

  if (customer.status !== CustomerStatusEnum.ACTIVE) {
    deny("Tài khoản bị khóa hoặc ngừng kích hoạt", 403);
  }

  const pageBlockSetting = await SettingModel.findOne({ key: "pa-b-page" }).select("isActive").lean();
  if (pageBlockSetting?.isActive === true) {
    deny("Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!", 403);
  }

  if (!isStandardPlusPlan(customer.googlePackage?.subscription)) {
    deny("Chức năng tạo giọng chỉ dành cho gói Standard trở lên. Vui lòng nâng cấp gói để sử dụng.", 403);
  }
}
