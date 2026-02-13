import _ from "lodash";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { ForbiddenError } from "../../../libs/core";
import { Scope } from "../../../libs/dal/authority";
import { CustomerModel, customerService } from "../../../libs/dal/customer";
import { InsertNotification, NotificationTarget } from "../../../libs/dal/notification";
import { Context } from "../../../libs/graphql";
import { NotificationBuilder } from "../notification/notificationBuilder";

const Query = {
  getAllCustomer: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-1"]]);
    return customerService.fetch(args.q);
  },
  getOneCustomer: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-1"]]);
    const { id } = args;
    return await customerService.findOne({ _id: id });
  },
};

const Mutation = {
  updateCustomer: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-3"]]);
    const { id, data } = args;
    const customer = await CustomerModel.findById(id).orFail(
      new ForbiddenError(t("Khách hàng không tồn tại"))
    );
    // Lấy giá trị hiện tại và giá trị bị thay đổi
    const getChangedValues = (oldData: any, newData: any) => {
      const oldValueArray = [] as any[];
      const newValueArray = [] as any[];
      // Duyệt qua tất cả các trường của đối tượng mới
      _.forEach(newData._doc, (value, key) => {
        const oldValue = _.get(oldData, key); // Lấy giá trị của trường từ đối tượng cũ

        if (typeof value == "object") return;
        if (!_.isEqual(oldValue, value)) {
          oldValueArray.push(oldValue);
          newValueArray.push(value);
        }
      });

      return { old: oldValueArray, new: newValueArray };
    };
    const customerUpdated = await customerService.updateOne(id, data);
    const changes = getChangedValues(customer, customerUpdated);
    // Tạo thông báo
    const customerNotify = new NotificationBuilder(
      t("Cập nhật khách hàng"),
      `Bạn đã cập nhật khách hàng thành công, giá trị cũ:[ ${changes.old} ] | giá trị đổi: [ ${changes.new} ] `
    )
      .sendTo(NotificationTarget.CUSTOMER, id)
      .account()
      .build();
    InsertNotification([customerNotify]);
    return customerUpdated;
  },
  deleteOneCustomer: async (root: any, args: any, context: Context) => {
    await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-4"]]);
    const { id } = args;
    return await customerService.deleteOne(id);
  },
};

const Customer = {};

export default {
  Query,
  Mutation,
  Customer,
};
