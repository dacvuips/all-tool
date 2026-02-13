import { Job } from "agenda";
import moment from "moment-timezone";

import logger from "../../helpers/logger";
import { ProcessExpiredWalletTransaction } from "../../libs/usecases/wallet";
import { Agenda } from "../agenda";

export class ProcessExpiredWalletTransactionJob {
  static jobName = "ProcessExpiredWalletTransaction";
  static create(data: any) {
    return Agenda.create(this.jobName, data);
  }
  static async execute(job: Job) {
    console.log("Execute Job " + ProcessExpiredWalletTransactionJob.jobName, moment().format());

    const { transactionId } = job.attrs.data;

    try {
      await ProcessExpiredWalletTransaction.usecase.execute({ transactionId: transactionId });
    } catch (err) {
      logger.error(`Cannot process expired order: ${err.message}`);
    } finally {
      job.remove();
    }
  }
}

export default ProcessExpiredWalletTransactionJob;
