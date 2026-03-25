import { ForbiddenError } from "apollo-server-core";
import { IsNotEmpty, Min } from "class-validator";

import { t } from "../../../helpers/functions/string";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { CreditTransactionTypeEnum, creditTransactionService } from "../../dal/creditTransaction";
import { CustomerModel } from "../../dal/customer";

export namespace ChargeNodeRunCredit {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    customerId: string;

    @IsNotEmpty()
    runId: string;

    @IsNotEmpty()
    productId: string;

    @IsNotEmpty()
    nodeId: string;

    @Min(1)
    @IsNotEmpty()
    amount: number;
  }

  class ChargeNodeRunCreditUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { customerId, runId, productId, nodeId, amount } = cmd;

      const customer = await CustomerModel.findOneAndUpdate(
        { _id: customerId, creditBalance: { $gte: amount } },
        { $inc: { creditBalance: -amount } },
        { new: true }
      );

      if (!customer) {
        throw new ForbiddenError(
          t("Số dư credit không đủ. Vui lòng nạp thêm credit để chạy node.")
        );
      }

      const balanceAfter = (customer as any).creditBalance ?? 0;

      await creditTransactionService.create({
        customerId,
        type: CreditTransactionTypeEnum.NODE_RUN_CHARGE,
        amount,
        balanceAfter,
        runId,
        productId,
        nodeId,
        description: `Trừ ${amount} credit cho run node (product: ${productId}, node: ${nodeId})`,
      });

      return { success: true, balanceAfter };
    }
  }

  export const usecase = new ChargeNodeRunCreditUsecase();
}
