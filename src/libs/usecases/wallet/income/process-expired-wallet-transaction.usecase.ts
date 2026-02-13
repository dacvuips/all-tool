import { IsNotEmpty } from "class-validator";

import { t } from "../../../../helpers/functions/string";
import { startSession } from "../../../../helpers/mongo";
import { IsObjectId } from "../../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../../core";
import { WalletModel } from "../../../dal/wallet";
import {
  WalletTransactionModel,
  WalletTranscationStatusEnum,
} from "../../../dal/walletTransaction";

export namespace ProcessExpiredWalletTransaction {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    transactionId: string;
  }

  class ProcessExpiredWalletTransactionUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      // find transaction
      const transaction = await WalletTransactionModel.findById(cmd.transactionId).orFail(
        new Error(t("Không tìm thấy giao dịch"))
      );

      // check transaction status
      if (transaction.status === WalletTranscationStatusEnum.PENDING) {
        // mark transaction as expired
        const session = await startSession();
        await session.withTransaction(async () => {
          // update wallet
          const updatedWallet = await WalletModel.findOneAndUpdate(
            {
              _id: transaction.walletId,
            },
            {
              $inc: {
                transactionNoun: 1,
              },
            },
            {
              session,
              new: true,
            }
          );

          // update transaction
          await WalletTransactionModel.updateOne(
            {
              _id: transaction._id,
            },
            {
              $set: {
                status: WalletTranscationStatusEnum.FAILED,
                balance: updatedWallet.balance,
                transactionNoun: updatedWallet.transactionNoun,
                failedReason: "Transaction expired",
              },
            },
            { session }
          );
        });
      }
    }
  }

  export const usecase = new ProcessExpiredWalletTransactionUsecase();
}
