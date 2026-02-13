import { Job } from "agenda";
import logger from "../../helpers/logger";

import { processExpiredOrderUsecase } from "../../libs/usecases/order/cancel/processExpiredOrder.usecase";
import { Agenda } from "../agenda";

export class ProcessExpiredOrderJob {
  static jobName = "ProcessExpiredOrder";
  static create(data: any) {
    return Agenda.create(this.jobName, data);
  }
  static async execute(job: Job) {
    const { orderId } = job.attrs.data;

    try {
      await processExpiredOrderUsecase.execute({ orderId: orderId });
    } catch (err) {
      logger.error(`Cannot process expired order: ${err.message}`);
    } finally {
      job.remove();
    }
  }
}

export default ProcessExpiredOrderJob;
