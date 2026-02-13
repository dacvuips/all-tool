import { IsNotEmpty, IsOptional } from "class-validator";
import { IsObjectId } from "../../../packages/class-validator";
import { BaseCommand, BaseUsecase, ForbiddenError } from "../../core";
import { IQueryInput } from "../../../base/crudService";
import _ from "lodash";
import { walletTransactionService } from "../../dal/walletTransaction";
import { WalletModel } from "../../dal/wallet";
import { GetWalletInfo } from "./get-wallet-info.usecase";

export namespace GetWalletTransactions {
  export class Command extends BaseCommand {
    @IsObjectId()
    @IsNotEmpty()
    ownerId: string;

    @IsOptional()
    query: IQueryInput;
  }

  class GetWalletTransactionsUsecase extends BaseUsecase {
    async execute(command: Command) {
      // find wallet
      const wallet = await GetWalletInfo.usecase.execute({
        ownerId: command.ownerId,
      });

      // set wallet id to query
      const { query } = command;
      _.set(query, "filter.walletId", wallet._id);

      // get wallet transactions
      const walletTransactions = await walletTransactionService.fetch(query);

      return {
        data: walletTransactions,
      };
    }
  }

  export const usecase = new GetWalletTransactionsUsecase();
}
