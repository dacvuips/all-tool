import { IsNotEmpty } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase } from "../../core";
import { WalletLoader, WalletModel } from "../../dal/wallet";
import { ModelDataLoader } from "../../../helpers/functions/dataloader";

export namespace GetWalletInfo {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    ownerId: string;
  }

  class GetWalletInfoUsecase extends BaseUsecase {
    async execute(cmd: Command) {
      const { ownerId } = cmd;

      // find wallet
      // ModelDataLoader.wallet.ownerId.clear(ownerId.toString());
      const wallet = await ModelDataLoader.wallet.ownerId.load(ownerId.toString());
      // if wallet not found, create new wallet
      if (!wallet) {
        const newWallet = await WalletModel.findOneAndUpdate(
          {
            ownerId: ownerId,
          },
          {
            $setOnInsert: {
              balance: 0,
              totalIn: 0,
              totalOut: 0,
              isLocked: false,
            },
          },
          { upsert: true, new: true }
        );
        return newWallet;
      } else {
        return await WalletModel.findById(wallet._id);
      }
    }
  }

  export const usecase = new GetWalletInfoUsecase();
}
