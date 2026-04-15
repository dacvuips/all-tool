import { ForbiddenError } from "apollo-server-express";
import { IsEmail, IsNotEmpty } from "class-validator";
import passwordHash from "password-hash";
import Firebase from "../../../../helpers/firebase";
import { convertPhone, t } from "../../../../helpers/functions/string";
import { getFirebaseErrorMsg } from "../../../../helpers/getFirebaseErrorMsg";
import { startSession } from "../../../../helpers/mongo";
import { BaseCommand, BaseUsecase } from "../../../core";
import { CustomerModel } from "../../../dal/customer";
import { IntroduceModel } from "../../../dal/introduce/introduce.model";
import { UserModel } from "../../../dal/user";
import { CreateNewCustomerAndShop, Payload } from "./create-customer";
export class CustomerRegistWithEmailCommand extends BaseCommand {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  password: string;
  introduceCode?: string;
}

type CustomerRegistWithEmailResponse = {
  success: boolean;
};
class CustomerRegistWithEmailUsercase extends BaseUsecase {
  async execute(cmd: CustomerRegistWithEmailCommand): Promise<CustomerRegistWithEmailResponse> {
    const { email, password, name, introduceCode } = cmd;

    // get customer by phone number and email to check exist customer
    const customer = await CustomerModel.findOne({
      $or: [{ email: email }],
    });

    const userExit = await UserModel.findOne({ email });
    if (userExit) {
      throw new ForbiddenError(
        t(
          "Tài khoản đã đăng ký ở một vai trò khác trên sàn, không được đăng nhập với vai trò khách, vui lòng đăng nhập bằng tài khoản khác"
        )
      );
    }
    if (customer) {
      throw new ForbiddenError(t("Số điện thoại hoặc email đã tồn tại"));
    }

    const fbCustomer = await Firebase.auth.createUser({ email, password }).catch((err) => {
      throw new ForbiddenError(getFirebaseErrorMsg(err));
    });

    const session = await startSession();
    await session
      .withTransaction(async () => {
        // create customer

        const payload: Payload = {
          name,
          email,
          uid: fbCustomer.uid,
          passwordHash: passwordHash.generate(password),
        };

        await CreateNewCustomerAndShop({ payload, session });
      })
      .finally(() => {
        session.endSession();
      });

    // Xử lý mã giới thiệu nếu có
    if (introduceCode) {
      const referrer = await CustomerModel.findOne({ code: introduceCode });
      if (!referrer) {
        throw new ForbiddenError(t("Mã giới thiệu không tồn tại, vui lòng kiểm tra lại"));
      }
      const newCustomer = await CustomerModel.findOne({ email });
      if (newCustomer) {
        const existingIntroduce = await IntroduceModel.findOne({ refereeId: newCustomer._id });
        if (!existingIntroduce) {
          await IntroduceModel.create({
            referrerId: referrer._id,
            refereeId: newCustomer._id,
          });
        }
      }
    }

    return {
      success: true,
    };
  }
}
export const customerRegistWithEmailUsecase = new CustomerRegistWithEmailUsercase();
