import _ from "lodash";
import { CRUDService } from "../../../base/crudService";
import { ObjectId } from "../../../packages/object-id";
import { ThreadStatus } from "./thread.interface";
import { ThreadModel } from "./thread.model";

class ThreadService extends CRUDService(ThreadModel) {
  async getThreadSeenCustomer(customerId: string) {
    const threadSeen = await this.model
      .aggregate([
        {
          $match: {
            customerId: ObjectId(customerId),
            seenCustomer: false,
            $or: [{ status: ThreadStatus.new }, { status: ThreadStatus.opening }],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ])
      .then((res) => {
        return _.get(res, "0", { count: 0 });
      });

    return threadSeen.count;
  }
  async getThreadSeenShop(shopId: string) {
    const threadSeen = await this.model
      .aggregate([
        {
          $match: {
            shopId: ObjectId(shopId),
            seenShop: false,
            $or: [{ status: ThreadStatus.new }, { status: ThreadStatus.opening }],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ])
      .then((res) => {
        return _.get(res, "0", { count: 0 });
      });

    return threadSeen.count;
  }
  async getThreadSeenStaff(staffId: string) {
    const threadSeen = await this.model
      .aggregate([
        {
          $match: {
            staffId: ObjectId(staffId),
            seenStaff: false,
            $or: [{ status: ThreadStatus.new }, { status: ThreadStatus.opening }],
          },
        },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
          },
        },
      ])
      .then((res) => {
        return _.get(res, "0", { count: 0 });
      });

    return threadSeen.count;
  }
}

const threadService = new ThreadService();
export { threadService };
