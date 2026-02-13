import { IsBoolean, IsNotEmpty, Min } from "class-validator";
import moment from "moment-timezone";

import { t } from "../../../../helpers/functions/string";
import { IsObjectId } from "../../../../packages/class-validator";
import { WalletTransactionCode } from "../../../../packages/wallet-transaction-code";
import ProcessExpiredWalletTransactionJob from "../../../../scheduler/jobs/processExpiredWalletTransaction.job";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../../core";
import { SettingModel } from "../../../dal/setting";
import {
  WalletTransactionModel,
  WalletTransactionSideEnum,
  WalletTransactionTypeEnum,
  WalletTranscationStatusEnum,
} from "../../../dal/walletTransaction";
import { GetWalletInfo } from "../get-wallet-info.usecase";

export namespace DepositWalletByCasso {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    ownerId: string;
    @IsBoolean()
    isShop: boolean;
    @Min(50000)
    @IsNotEmpty()
    amount: number;
  }

  class DepositWalletByCassoUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { ownerId, amount, isShop } = cmd;
      await SettingModel.findOne({
        key: isShop ? "wa-shop-deposit" : "wa-partner-deposit",
        value: true,
      }).orFail(
        new ForbiddenError(
          t(`Chức năng này hiện tại đang tạm khóa,bạn vui lòng sử dụng các dịch vụ khác`)
        )
      );
      // find wallet
      const wallet = await GetWalletInfo.usecase.execute({ ownerId: ownerId });

      // create transaction
      const transaction = await WalletTransactionModel.create({
        code: this.generateCode(),
        walletId: wallet._id,
        ownerId: wallet.ownerId,
        amount: amount,
        description: `Nạp tiền chuyển khoản`,
        type: WalletTransactionTypeEnum.DEPOSIT,
        side: WalletTransactionSideEnum.IN,
        transactionNoun: 0, // TODO: need to update this field
        balance: 0, // TODO: need to update this field
        status: WalletTranscationStatusEnum.PENDING,
      });

      // create timeout job
      await this.createCheckTimeoutJob(transaction._id, moment().add(30, "minutes").toDate());

      return transaction;
    }

    private generateCode() {
      return WalletTransactionCode.generate();
    }

    private async createCheckTimeoutJob(transactionId: string, timeoutAt: Date) {
      await ProcessExpiredWalletTransactionJob.create({ transactionId }).schedule(timeoutAt).save();
    }
  }

  export const usecase = new DepositWalletByCassoUsecase();
}
