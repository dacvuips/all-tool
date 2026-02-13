import { ForbiddenError } from "apollo-server-express";
import { IsEmail, IsNotEmpty } from "class-validator";
import passwordHash from "password-hash";
import Firebase from "../../../../helpers/firebase";
import { convertPhone, t } from "../../../../helpers/functions/string";
import { getFirebaseErrorMsg } from "../../../../helpers/getFirebaseErrorMsg";
import { startSession } from "../../../../helpers/mongo";
import { BaseCommand, BaseUsecase } from "../../../core";
import { CustomerModel } from "../../../dal/customer";
import { UserModel } from "../../../dal/user";
import { CreateNewCustomerAndShop, Payload } from "./create-customer";
export class CustomerRegistWithEmailCommand extends BaseCommand {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  phoneNumber: string;
  @IsNotEmpty()
  @IsEmail()
  email: string;
  @IsNotEmpty()
  password: string;
}

type CustomerRegistWithEmailResponse = {
  success: boolean;
};
class CustomerRegistWithEmailUsercase extends BaseUsecase {
  async execute(cmd: CustomerRegistWithEmailCommand): Promise<CustomerRegistWithEmailResponse> {
    const { phoneNumber, email, password, name } = cmd;

    // get customer by phone number and email to check exist customer
    const customer = await CustomerModel.findOne({
      $or: [{ phoneNumber: convertPhone(phoneNumber, "") }, { email: email }],
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
          phoneNumber: convertPhone(phoneNumber, ""),
          passwordHash: passwordHash.generate(password),
        };

        await CreateNewCustomerAndShop({ payload, session });
      })
      .finally(() => {
        session.endSession();
      });
    return {
      success: true,
    };
  }
}
export const customerRegistWithEmailUsecase = new CustomerRegistWithEmailUsercase();
