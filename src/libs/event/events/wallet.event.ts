import { BaseCommand } from "../../core";
import { IWalletTransaction } from "../../dal/walletTransaction";

export class WalletEvent extends BaseCommand {
  transcation: IWalletTransaction;
  ownerName: string;
}
