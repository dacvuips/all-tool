import { IsNotEmpty, Min } from "class-validator";

import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import {
  CreditTransactionTypeEnum,
  creditTransactionService,
} from "../../dal/creditTransaction";
import { CustomerModel } from "../../dal/customer";

export namespace RefundNodeRunCredit {
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

    /** Id giao dịch CHARGE gốc (để đối soát) */
    refTransactionId?: string;
  }

  class RefundNodeRunCreditUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { customerId, runId, productId, nodeId, amount, refTransactionId } = cmd;

      const customer = await CustomerModel.findByIdAndUpdate(
        customerId,
        { $inc: { creditBalance: amount } },
        { new: true }
      );

      if (!customer) {
        this.logger.warn(`RefundNodeRunCredit: customer not found ${customerId}`);
        return { success: false };
      }

      const balanceAfter = (customer as any).creditBalance ?? 0;

      await creditTransactionService.create({
        customerId,
        type: CreditTransactionTypeEnum.NODE_RUN_REFUND,
        amount,
        balanceAfter,
        runId,
        productId,
        nodeId,
        description: `Hoàn ${amount} credit do run node thất bại (product: ${productId}, node: ${nodeId})`,
        refTransactionId,
      });

      return { success: true, balanceAfter };
    }
  }

  export const usecase = new RefundNodeRunCreditUsecase();
}
