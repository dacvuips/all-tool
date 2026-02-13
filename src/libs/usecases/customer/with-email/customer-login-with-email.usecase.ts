import { IsNotEmpty, IsString } from "class-validator";
import _ from "lodash";

import { Types } from "mongoose";
import passwordHash from "password-hash";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import cache from "../../../../helpers/cache";
import Firebase from "../../../../helpers/firebase";
import { t } from "../../../../helpers/functions/string";
import { startSession } from "../../../../helpers/mongo";
import Token from "../../../../helpers/token";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { CustomerModel, ICustomer } from "../../../dal/customer";
import { OrderModel } from "../../../dal/order/order.model";
import { SettingModel } from "../../../dal/setting";
import { UserModel } from "../../../dal/user";
import { CustomerStatusEnum, SECURITY_CONFIG } from "../../../shared";
import { CreateNewCustomerAndShop, Payload } from "./create-customer";

export class CustomerLoginWithEmailCommand extends BaseCommand {
  @IsNotEmpty()
  @IsString()
  accessToken: string;
  @IsNotEmpty()
  @IsString()
  pw: string;
}

type CustomerLoginWithEmailResponse = {
  customer: ICustomer;
  accessToken: string;
};

class CustomerLoginWithEmailUsecase extends BaseUsecase {
  async execute(
    cmd: CustomerLoginWithEmailCommand,
    context?: any
  ): Promise<CustomerLoginWithEmailResponse> {
    const { accessToken, pw } = cmd;

    // Cấu hình bật tắt chức năng mua thẻ game
    await SettingModel.findOne({ key: "pa-b-page", isActive: false }).orFail(
      new ForbiddenError(t("Sàn hiện tại đang ngưng hoạt động, quý khách vui lòng quay lại sau!"))
    );

    let decoded = await Firebase.auth.verifyIdToken(accessToken);

    // find a customer by phone
    const userExit = await UserModel.findOne({ uid: decoded.uid });
    if (userExit) {
      throw new ForbiddenError(
        t(
          "Tài khoản đã đăng ký ở một vai trò khác trên sàn, không được đăng nhập với vai trò khách, vui lòng đăng nhập bằng tài khoản khác"
        )
      );
    }
    const customerData = await CustomerModel.findOne({ uid: decoded.uid });
    let customer: ICustomer;

    if (!customerData) {
      // create new customer with google account
      const session = await startSession();
      await session
        .withTransaction(async () => {
          const payload: Payload = {
            email: decoded.email,
            uid: decoded.sub,
            name: decoded.name,
            avatarUrl: decoded.picture,
          };
          customer = await CreateNewCustomerAndShop({ payload, session });
        })
        .finally(() => {
          session.endSession();
        });
    } else {
      customer = customerData;
      // update password nếu khác password, phục vụ cho việc lấy lại pass bằng link Email, không thể tìm ra được thông tin customer nên mới dùng cách này
      if (!passwordHash.verify(pw, customerData.passwordHash)) {
        const hashedPassword = passwordHash.generate(pw);
        customerData.passwordHash = hashedPassword;

        await customerData.save();
      }
    }
    if (customer.status != CustomerStatusEnum.ACTIVE) {
      throw new ForbiddenError(t("Tài khoản bị khóa hoặc ngừng kích hoạt"));
    }

    const payload = {
      name: customer.name || customer.email,
      sessionId: new Types.ObjectId().toString(),
    };

    // update các order đơn hàng chờ thanh toán từ guest sang customer để tiện quản lý

    await OrderModel.updateMany(
      {
        customerId: null,
        sessionId: context.req.cookies?.cartSessionId,
      },
      { customerId: customer._id }
    );
    // generate access token
    const loginToken = new Token(customer._id, TOKEN_ROLES.CUSTOMER, payload, "1d");
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

export const customerLoginWithEmailUsecase = new CustomerLoginWithEmailUsecase();
