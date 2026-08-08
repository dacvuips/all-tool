import { Length } from "class-validator";
import _ from "lodash";
import passwordHash from "password-hash";

import { Types } from "mongoose";
import { TOKEN_ROLES } from "../../../constants/role.const";
import cache from "../../../helpers/cache";
import { t } from "../../../helpers/functions/string";
import Token, { CUSTOMER_TOKEN_EXPIRES_IN } from "../../../helpers/token";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { CustomerModel, ICustomer } from "../../dal/customer";
import { SettingModel } from "../../dal/setting";
import { SECURITY_CONFIG } from "../../shared";

export class CustomerLoginCommand extends BaseCommand {
  @Length(6, 30)
  phone: string;
  @Length(32)
  password: string;
}

type CustomerLoginResponse = {
  customer: ICustomer;
  accessToken: string;
};

class CustomerLoginUsecase extends BaseUsecase {
  async execute(cmd: CustomerLoginCommand): Promise<CustomerLoginResponse> {
    const { phone, password } = cmd;
    // Cấu hình bật tắt chức năng mua thẻ game
    await SettingModel.findOne({ key: "pa-b-page", isActive: false }).orFail(
      new ForbiddenError(t("Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!"))
    );
    // find a customer by phone
    const customer = await CustomerModel.findOne({ phoneNumber: phone });

    if (!customer) {
      throw new ForbiddenError(t("Tài khoản hoặc mật khẩu không đúng"));
    }

    // check password
    if (!passwordHash.verify(password, customer.passwordHash)) {
      throw new ForbiddenError(t("Tài khoản hoặc mật khẩu không đúng"));
    }

    const payload = {
      name: customer.name,
      sessionId: new Types.ObjectId().toString(),
    };
    // generate access token
    const accessToken = new Token(
      customer._id,
      TOKEN_ROLES.CUSTOMER,
      payload,
      CUSTOMER_TOKEN_EXPIRES_IN
    );
    _.set(
      customer,
      "phoneNumber",
      customer.phoneNumber.slice(0, 3) +
        "***" +
        customer.phoneNumber.substring(customer.phoneNumber.length - 4)
    );

    const token = accessToken.sign();

    if (SECURITY_CONFIG.auth.useSession) {
      const decoded = Token.decode(token);
      const exp = decoded.payload.exp - decoded.payload.iat;
      await cache.set("token-session:customer:" + customer._id, payload.sessionId, exp);
    }

    return {
      customer,
      accessToken: token,
    };
  }
}

export const customerLoginUsecase = new CustomerLoginUsecase();
