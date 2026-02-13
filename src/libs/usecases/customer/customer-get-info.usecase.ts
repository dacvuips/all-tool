import _ from "lodash";

import { t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand } from "../../core";
import { CustomerModel } from "../../dal/customer";

export class CustomerGetInfoCommand extends CustomerCommand {}

type CustomerGetInfoResponse = {
  customer: Omit<Object, "passwordHash">;
};
class CustomerGetInfoUsecase extends BaseUsecase {
  async execute(cmd: CustomerGetInfoCommand): Promise<CustomerGetInfoResponse> {
    const customer = await CustomerModel.findById(cmd.customerId).select("-uid -times");

    if (!customer) throw new Error(t("Không tìm thấy thông tin khách hàng"));

    return {
      customer: _.omit(customer.toJSON(), ["passwordHash"]),
    };
  }
}

export const customerGetInfoUsecase = new CustomerGetInfoUsecase();
