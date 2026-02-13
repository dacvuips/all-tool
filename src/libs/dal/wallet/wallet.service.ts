import { ClientSession } from "mongoose";
import { CRUDService } from "../../../base/crudService";
import { t } from "../../../helpers/functions/string";
import logger from "../../../helpers/logger";
import { EventProvider, WalletChangeEmailConsumer, WalletEvent } from "../../event";
import { CustomerLoader } from "../customer";
import { UserLoader } from "../user";
import {
  IWalletTransaction,
  WalletTransactionModel,
  WalletTransactionSideEnum,
} from "../walletTransaction";
import { WalletModel } from "./wallet.model";

class WalletService extends CRUDService(WalletModel) {
  logger = logger.child({ _reqId: this.constructor.name });
  async createTransaction({
    transaction,
    session,
    allowNagative = false,
  }: {
    transaction: IWalletTransaction;
    session: ClientSession;
    allowNagative?: boolean; // allow negative balance
  }) {
    // update wallet
    const incData: any = {
      transactionNoun: 1,
    };
    const walletMatch: any = { _id: transaction.walletId };
    const setData: any = {};
    incData.balance = transaction.amount;
    if (transaction.side === WalletTransactionSideEnum.IN) {
      incData.totalIn = transaction.amount;
      setData["times.lastIn"] = new Date();
    } else {
      incData.totalOut = Math.abs(transaction.amount);
      setData["times.lastOut"] = new Date();
      if (!allowNagative) {
        walletMatch.balance = { $gte: incData.totalOut };
      }
    }

    const updatedWallet = await WalletModel.findOneAndUpdate(
      { ...walletMatch },
      { $inc: incData, $set: setData },
      { session, new: true }
    );

    if (!updatedWallet) {
      throw new Error(t(`mPoint không đủ số dư`));
    }

    // create transaction
    transaction.transactionNoun = updatedWallet.transactionNoun;
    transaction.balance = updatedWallet.balance;

    this.logger.debug(
      `[${updatedWallet.ownerId}] wallet change ${transaction.side}. Amount: ${transaction.amount}, Balance: ${transaction.balance}.`
    );

    await WalletTransactionModel.create([transaction], { session });

    session.once("ended", async () => {
      // when session is end, check transaction is commit success or not
      // if success, then send an email to owner
      const commitedTrans = await WalletTransactionModel.findById(transaction._id);
      if (commitedTrans) {
        this.logger.debug(`Transcation commit success, send email`);
        const owner =
          (await UserLoader.load(transaction.ownerId)) ||
          (await CustomerLoader.load(transaction.ownerId));

        // send email
        new EventProvider<WalletEvent>()
          .registerConsumer(new WalletChangeEmailConsumer({ to: owner.email }))
          .publish({
            transcation: transaction,
            ownerName: owner.name,
          });
      } else {
        this.logger.debug(`Transaction aborted. Skip send email`);
      }
    });

    return updatedWallet;
  }
}

const walletService = new WalletService();
export { walletService };
