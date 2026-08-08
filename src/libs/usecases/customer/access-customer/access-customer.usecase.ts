import { IsNotEmpty, IsString } from "class-validator";
import { Types } from "mongoose";
import { TOKEN_ROLES } from "../../../../constants/role.const";
import cache from "../../../../helpers/cache";
import { t } from "../../../../helpers/functions/string";
import Token, { CUSTOMER_TOKEN_EXPIRES_IN } from "../../../../helpers/token";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { CustomerModel } from "../../../dal/customer";
import { SECURITY_CONFIG } from "../../../shared";

export namespace AccessCustomer {
  export class Command extends BaseCommand {
    @IsString()
    @IsNotEmpty()
    shopToken: string;
  }

  class AccessCustomer extends BaseUsecase {
    async execute(command: Command) {
      const { shopToken } = command;

      const decoded = Token.decode(shopToken);
      const customerId = decoded.payload.customerId;
      // find shop by id
      const customer = await CustomerModel.findById(customerId).orFail(
        new ForbiddenError(t(`Tài khoản khách hàng không tồn tại`))
      );

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

  export const usecase = new AccessCustomer();
}
