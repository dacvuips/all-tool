import config from "config";
import _ from "lodash";

import { Casso } from "../../../../packages/casso";
import { BaseCommand, BaseUsecase } from "../../../core";

export class SyncCassoTransactionCommand extends BaseCommand {
  bankAccId: string;
}

type SyncCassoTransactionResponse = {
  success: boolean;
};

class SyncCassoTransactionUseCase extends BaseUsecase {
  syncThrottler = _.throttle(this.syncCasso, 1000 * 60, { trailing: false });
  apiKey = config.get<string>("casso.apiKey");
  async execute(command: SyncCassoTransactionCommand): Promise<SyncCassoTransactionResponse> {
    const { bankAccId } = command;

    this.syncThrottler(bankAccId);

    return {
      success: true,
    };
  }

  async syncCasso(bankAccId: string) {
    const result = await Casso.sync(this.apiKey, bankAccId);
    this.logger.info(`Đồng bộ giao dịch từ Casso thành công. Mã ngân hàng: ${bankAccId}`);
    return result;
  }
}

export const syncCassoTransactionUseCase = new SyncCassoTransactionUseCase();
