import { IsNotEmpty } from "class-validator";
import { NotificationBuilder } from "../../../../graphql/modules/notification/notificationBuilder";
import { t } from "../../../../helpers/functions/string";
import { startSession } from "../../../../helpers/mongo";
import { IsObjectId } from "../../../../packages/class-validator";
import { ForbiddenError, UserCommand } from "../../../core";
import { CustomerModel } from "../../../dal/customer";
import { InsertNotification, NotificationTarget } from "../../../dal/notification";
import { UserModel } from "../../../dal/user";
import { WalletModel, walletService } from "../../../dal/wallet";
import { WalletTransactionBuilder } from "../wallet-transaction.builder";

export namespace DepositWalletManual {
  export class Command extends UserCommand {
    @IsObjectId()
    @IsNotEmpty()
    walletId: string;

    // @Min(1000)
    @IsNotEmpty()
    amount: number;

    @IsNotEmpty()
    description: string;
  }

  class DepositWalletManualUsecase {
    async execute(cmd: Command) {
      const { walletId, amount, description, userId } = cmd;

      const wallet = await WalletModel.findById(walletId).orFail(
        new ForbiddenError(t("mPoint không tồn tại"))
      );
      let owner = "";
      await CustomerModel.findById(wallet.ownerId)
        .select("name")
        .then(async (res) => {
          if (!res) {
            await UserModel.findById(wallet.ownerId)
              .select("name")
              .then((res) => {
                owner = res.name;
              });
            return;
          }
          owner = res.name;
        });

      // create deposit transaction
      const transaction = new WalletTransactionBuilder(wallet)
        .deposit({
          amount: amount,
          description: description,
          userId: userId,
        })
        .build();

      // create transaction
      const session = await startSession();
      await session
        .withTransaction(async () => {
          const updatedWallet = await walletService.createTransaction({
            transaction: transaction,
            session: session,
          });
          if (!updatedWallet) {
            throw new ForbiddenError(t("Giao dịch không thành công, vui lòng thử lại"));
          }
          // Tạo thông báo
          const customerNotify = new NotificationBuilder(
            "Nạp tiền thủ công",
            `Bạn đã nạp tiền vào ví, Chủ ví: ${owner}, Số dư ví ban đầu: ${
              wallet.balance
            }, số điểm cộng: +${amount}, Số ví hiện tại: ${
              wallet.balance + amount
            }, lý do: ${description}`
          )
            .sendTo(NotificationTarget.USER, cmd.userId)
            .wallet()
            .build();
          InsertNotification([customerNotify]);
        })
        .finally(() => {
          session.endSession();
        });

      return {
        success: true,
      };
    }
  }

  export const usecase = new DepositWalletManualUsecase();
}
