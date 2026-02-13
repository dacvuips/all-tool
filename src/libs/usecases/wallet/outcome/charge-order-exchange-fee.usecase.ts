import { IsNotEmpty, Min } from "class-validator";
import { ClientSession } from "mongoose";

import { t } from "../../../../helpers/functions/string";
import { IsObjectId } from "../../../../packages/class-validator";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { walletService } from "../../../dal/wallet";
import { GetWalletInfo } from "../get-wallet-info.usecase";
import { WalletTransactionBuilder } from "../wallet-transaction.builder";

export namespace ChargeOrderExchangeFee {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    ownerId: string;

    @IsObjectId()
    @IsNotEmpty()
    orderId: string;

    @IsNotEmpty()
    orderCode: string;

    @Min(1)
    @IsNotEmpty()
    amount: number;

    session: ClientSession;
  }

  class ChargeOrderExchangeFeeUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { ownerId, orderId, orderCode, amount, session } = cmd;

      const wallet = await GetWalletInfo.usecase.execute({ ownerId: ownerId });

      // check wallet balance
      if (wallet.balance < amount) {
        throw new ForbiddenError(t("mPoint không đủ. Vui lòng nạp thêm mPoint."));
      }

      const updatedWallet = await walletService.createTransaction({
        transaction: new WalletTransactionBuilder(wallet)
          .exchangeFee({
            amount: amount,
            orderId: orderId,
            orderCode: orderCode,
          })
          .build(),
        session: session,
      });

      if (!updatedWallet) {
        throw new ForbiddenError(t("Giao dịch không thành công. Vui lòng thử lại"));
      }

      return updatedWallet;
    }
  }

  export const usecase = new ChargeOrderExchangeFeeUsecase();
}
