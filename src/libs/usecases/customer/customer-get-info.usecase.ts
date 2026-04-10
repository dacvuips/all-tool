import _ from "lodash";

import { t } from "../../../helpers/functions/string";
import { BaseUsecase, CustomerCommand } from "../../core";
import { CustomerModel } from "../../dal/customer";
import { SubscriptionPlanEnum } from "../../dal/customer/customer.interface";

export class CustomerGetInfoCommand extends CustomerCommand {}

type CustomerGetInfoResponse = {
  customer: Omit<Object, "passwordHash">;
};
class CustomerGetInfoUsecase extends BaseUsecase {
  async execute(cmd: CustomerGetInfoCommand): Promise<CustomerGetInfoResponse> {
    const customer = await CustomerModel.findById(cmd.customerId).select("-uid -times");

    if (!customer) throw new Error(t("Không tìm thấy thông tin khách hàng"));

    const json = customer.toJSON();

    // Ensure googlePackage always has default values for older documents
    if (!json.googlePackage) {
      json.googlePackage = {
        subscription: SubscriptionPlanEnum.FREE,
        videoCount: 0,
        videoLimit: 0,
        imageCount: 0,
        imageLimit: 0,
        imageStreamCount: 0,
        videoStreamCount: 0,
        expiryPackageDate: null,
      };
    }

    return {
      customer: _.omit(json, ["passwordHash"]),
    };
  }
}

export const customerGetInfoUsecase = new CustomerGetInfoUsecase();
