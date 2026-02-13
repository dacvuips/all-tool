import DataLoader from "dataloader";
import { get, keyBy } from "lodash";
import { IAuthority } from "../../../libs/dal/authority/authority.interface";
import { DeviceInfoModel } from "../../../libs/dal/deviceInfo/deviceInfo.model";
import { NotificationModel } from "../../../libs/dal/notification";
import { IUser } from "../../../libs/dal/user";
import { ObjectId } from "../../../packages/object-id";

export class UserHelper {
  constructor(public user: IUser) {}

  static unseenNotifyLoader = new DataLoader<string, number>(
    (ids: string[]) => {
      return NotificationModel.aggregate([
        {
          $match: {
            userId: { $in: ids.map(ObjectId) },
            seen: false,
          },
        },
        { $group: { _id: "$userId", count: { $sum: 1 } } },
      ])
        .exec()
        .then((list: any[]) => {
          const listByKey = keyBy(list, "_id");
          return ids.map((id) => get(listByKey, `${id}.count`, 0));
        });
    },
    { cache: false } // Bỏ cache
  );
  value() {
    return this.user;
  }
  async setDevice(deviceId: string, deviceToken: string) {
    await DeviceInfoModel.deleteMany({ $or: [{ deviceToken }, { deviceId }] });
    await DeviceInfoModel.create({
      userId: this.user._id,
      deviceId,
      deviceToken,
    });
  }

  async getUnseenNotify() {
    return await UserHelper.unseenNotifyLoader.load(this.user._id.toString());
  }
  setAuthority(authority: IAuthority) {
    this.user.authorityIds = [authority._id, ...authority.parentIds];
    this.user.scopes = authority.scopes;
    return this;
  }

  maskPhone(phone: string): string {
    return phone.slice(0, 3) + "***" + phone.substring(phone.length - 4);
  }

  maskEmail(email: string): string {
    return email.slice(0, email.lastIndexOf("@") - 3) + "***" + email.slice(email.lastIndexOf("@"));
  }
}
