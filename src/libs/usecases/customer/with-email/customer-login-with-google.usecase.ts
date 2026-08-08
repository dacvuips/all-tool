import { IsNotEmpty, IsString } from "class-validator";
import _ from "lodash";

import { Types } from "mongoose";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import cache from "../../../../helpers/cache";
import { t } from "../../../../helpers/functions/string";
import { startSession } from "../../../../helpers/mongo";
import Token, { CUSTOMER_TOKEN_EXPIRES_IN } from "../../../../helpers/token";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { CustomerModel, ICustomer } from "../../../dal/customer";
import { SettingModel } from "../../../dal/setting";
import { UserModel } from "../../../dal/user";
import { CustomerStatusEnum, SECURITY_CONFIG } from "../../../shared";
import { CreateNewCustomerAndShop, Payload } from "./create-customer";

export class CustomerLoginWithGoogleCommand extends BaseCommand {
  @IsNotEmpty()
  @IsString()
  accessToken: string;
}

type CustomerLoginWithGoogleResponse = {
  customer: ICustomer;
  accessToken: string;
};

class CustomerLoginWithGoogleUsecase extends BaseUsecase {
  async execute(cmd: CustomerLoginWithGoogleCommand): Promise<CustomerLoginWithGoogleResponse> {
    const { accessToken } = cmd;

    // Cấu hình bật tắt chức năng mua thẻ game
    await SettingModel.findOne({ key: "pa-b-page", isActive: false }).orFail(
      new ForbiddenError(t("Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!"))
    );

    // find a customer by phone
    const decoded = Token.decodeNotSecretKey(accessToken);
    const userExit = await UserModel.findOne({ uid: decoded.payload.uid });
    if (userExit) {
      throw new ForbiddenError(
        t(
          "Tài khoản đã đăng ký ở một vai trò khác trên sàn, không được đăng nhập với vai trò khách, vui lòng đăng nhập bằng tài khoản khác"
        )
      );
    }
    const customerData = await CustomerModel.findOne({ uid: decoded.payload.uid });
    let customer: ICustomer;

    if (!customerData) {
      // create new customer with google account
      const session = await startSession();
      await session
        .withTransaction(async () => {
          const payload: Payload = {
            email: decoded.payload.email,
            uid: decoded.payload.sub,
            name: decoded.payload.name,
            avatarUrl: decoded.payload.picture,
          };

          customer = await CreateNewCustomerAndShop({ payload, session });
        })
        .finally(() => {
          session.endSession();
        });
    } else {
      customer = customerData;
    }

    if (customer.status != CustomerStatusEnum.ACTIVE) {
      throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
    }

    const payload = {
      name: customer.name,
      sessionId: new Types.ObjectId().toString(),
    };
    // generate access token
    const loginToken = new Token(
      customer._id,
      TOKEN_ROLES.CUSTOMER,
      payload,
      CUSTOMER_TOKEN_EXPIRES_IN
    );

    if (customer.phoneNumber) {
      _.set(
        customer,
        "phoneNumber",
        customer.phoneNumber.slice(0, 3) +
          "***" +
          customer.phoneNumber.substring(customer.phoneNumber.length - 4)
      );
    }
    if (customer.email) {
      _.set(
        customer,
        "email",
        customer.email.slice(0, customer.email.lastIndexOf("@") - 3) +
          "***" +
          customer.email.slice(customer.email.lastIndexOf("@"))
      );
    }
    const token = loginToken.sign();

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

export const customerLoginWithGoogleUsecase = new CustomerLoginWithGoogleUsecase();
