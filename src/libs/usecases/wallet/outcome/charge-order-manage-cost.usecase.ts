import { IsNotEmpty, Min } from "class-validator";
import { ClientSession } from "mongoose";

import { t } from "../../../../helpers/functions/string";
import { IsObjectId } from "../../../../packages/class-validator";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { walletService } from "../../../dal/wallet";
import { GetWalletInfo } from "../get-wallet-info.usecase";
import { WalletTransactionBuilder } from "../wallet-transaction.builder";

export namespace ChargeOrderManageCost {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    ownerId: string;

    @IsObjectId()
    @IsNotEmpty()
    managerId: string;

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

  class ChargeOrderManageCostUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { ownerId, orderId, orderCode, amount, session } = cmd;

      const wallet = await GetWalletInfo.usecase.execute({ ownerId: ownerId });
      const managerWallet = await GetWalletInfo.usecase.execute({ ownerId: cmd.managerId });

      const updatedWallet = await walletService.createTransaction({
        transaction: new WalletTransactionBuilder(wallet)
          .manageCost({
            amount: amount,
            orderId: orderId,
            orderCode: orderCode,
          })
          .build(),
        session: session,
      });

      const updatedManagerWallet = await walletService.createTransaction({
        transaction: new WalletTransactionBuilder(managerWallet)
          .manageCommission({
            amount: amount,
            orderId: orderId,
            orderCode: orderCode,
            fromUserId: ownerId,
          })
          .build(),
        session: session,
      });

      if (!updatedWallet || !updatedManagerWallet) {
        throw new ForbiddenError(t("Giao dịch không thành công. Vui lòng thử lại"));
      }

      return updatedWallet;
    }
  }

  export const usecase = new ChargeOrderManageCostUsecase();
}
