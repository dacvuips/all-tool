import { ClientSession } from "mongoose";
import { CustomerModel, customerService } from "../../../dal/customer";
import { CustomerStatusEnum } from "../../../shared";

interface CreateCustomerType {
  session: ClientSession;
  payload: Payload;
}
export interface Payload {
  email: string;
  uid: string;
  name?: string;
  avatarUrl?: string;
  phoneNumber?: string;
  passwordHash?: string;
}

export const CreateNewCustomerAndShop = async ({ payload, session }: CreateCustomerType) => {
  const customer = await CreateCustomer({ payload, session });

  return customer;
};
export const CreateCustomer = async ({ payload, session }: CreateCustomerType) => {
  const customerCode = await customerService.CustomerGenerateCode();
  const { email, uid, name, avatarUrl, phoneNumber, passwordHash } = payload;
  const customer = await CustomerModel.findOneAndUpdate(
    { email },
    {
      code: customerCode,
      uid,
      name: name || customerCode,
      email,
      avatarUrl,
      phoneNumber,
      status: CustomerStatusEnum.ACTIVE,
      passwordHash,
    },
    { upsert: true, new: true, session }
  );

  return customer;
};

interface createShopProps {
  session: ClientSession;
  customerId: string;
}
