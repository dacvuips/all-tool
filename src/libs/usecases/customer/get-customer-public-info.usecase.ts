import { BaseUsecase, CustomerCommand } from "../../core";
import { CustomerLoader } from "../../dal/customer";

export namespace GetCustomerPublicInfo {
  export class Command extends CustomerCommand {}

  export class GetCustomerPublicInfoUsecase extends BaseUsecase {
    async execute(command: Command) {
      // find user by id
      const customer = await CustomerLoader.load(command.customerId);
      if (!customer) {
        return null;
      }
      return {
        id: customer.id,
        name: customer.name,
        avatarUrl: customer.avatarUrl,
        email: customer.email,
      };
    }
  }

  export const usecase = new GetCustomerPublicInfoUsecase();
}
