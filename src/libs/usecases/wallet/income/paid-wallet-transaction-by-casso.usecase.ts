import { IsNotEmpty, Min } from "class-validator";
import { t } from "../../../../helpers/functions/string";
import { MainConnection, startSession } from "../../../../helpers/mongo";
import { WalletTransactionCode } from "../../../../packages/wallet-transaction-code";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { WalletModel } from "../../../dal/wallet";
import {
  WalletInfoKeyEnum,
  WalletTransactionModel,
  WalletTranscationStatusEnum,
} from "../../../dal/walletTransaction";

export namespace PaidWalletTransactionByCasso {
  export class Command extends BaseCommand {
    @IsNotEmpty()
    cassoId: string; // Mã giao dịch casso
    @IsNotEmpty()
    bankId: string; // Mã ngân hàng
    @IsNotEmpty()
    bankTransId: string; // Mã giao dịch ngân hàng
    @IsNotEmpty()
    description: string; // Nội dung chuyển khoản
    @Min(0)
    amount: number; // Số tiền chuyển khoản
    corresponsiveName?: string; // Tên người nhận
    corresponsiveAccount?: string; // Số tài khoản người nhận
    corresponsiveBankId?: string; // Mã ngân hàng người nhận
    corresponsiveBankName?: string; // Tên ngân hàng người nhận
    bankName?: string; // Tên ngân hàng
    subAccId?: string; // Mã tài khoản con
  }

  class PaidWalletTransactionByCassoUsecase extends BaseUsecase {
    async execute(command: Command) {
      // record transaction
      await MainConnection.collection("casso_transactions").insertOne(command);

      const orderCode = this.matchOrderCode(command.description);
      // filter is paid for order transaction by description
      if (!orderCode) {
        throw new ForbiddenError(t("Mã đơn hàng không tìm thấy"));
      }

      // find order
      const transaction = await WalletTransactionModel.findOne({ code: orderCode }).orFail(
        new ForbiddenError(t("Không tìm thấy giao dịch"))
      );

      // check order status
      if (transaction.status !== WalletTranscationStatusEnum.PENDING) {
        throw new ForbiddenError(t("Giao dịch không ở trạng thái chờ xử lý"));
      }

      // check order amount and amount from casso
      if (command.amount < transaction.amount) {
        throw new ForbiddenError(t("Số tiền chuyển khoản không đúng với số tiền giao dịch"));
      }

      // find wallet
      const wallet = await WalletModel.findById(transaction.walletId).orFail(
        new ForbiddenError(t("Không tìm thấy ví"))
      );

      const session = await startSession();

      await session
        .withTransaction(async () => {
          // update wallet
          const updatedWallet = await WalletModel.findOneAndUpdate(
            { _id: wallet._id },
            {
              $inc: {
                balance: transaction.amount,
                totalIn: transaction.amount,
                transactionNoun: 1,
              },
              $set: {
                "times.lastIn": new Date(),
              },
            },
            { session, new: true }
          );
          // update transaction status
          await WalletTransactionModel.findOneAndUpdate(
            { _id: transaction._id },
            {
              $set: {
                status: WalletTranscationStatusEnum.SUCCESS,
                transactionNoun: updatedWallet.transactionNoun,
                balance: updatedWallet.balance,
                amount: transaction.amount,
                specificInfo: [
                  {
                    key: WalletInfoKeyEnum.CASSO_PAYMENT_INFO,
                    value: {
                      cassoId: command.cassoId,
                      bankId: command.bankId,
                      bankTransId: command.bankTransId,
                      description: command.description,
                      amount: command.amount,
                      corresponsiveName: command.corresponsiveName,
                      corresponsiveAccount: command.corresponsiveAccount,
                      corresponsiveBankId: command.corresponsiveBankId,
                      corresponsiveBankName: command.corresponsiveBankName,
                      bankName: command.bankName,
                      subAccId: command.subAccId,
                    },
                  },
                ],
              },
            },
            { session }
          );
        })
        .finally(() => {
          session.endSession();
        });
    }

    private matchOrderCode(description: string) {
      return WalletTransactionCode.getOrderCodeFromText(description);
    }
  }
  export const usecase = new PaidWalletTransactionByCassoUsecase();
}
