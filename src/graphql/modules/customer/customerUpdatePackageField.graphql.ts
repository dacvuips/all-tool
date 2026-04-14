import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { Scope } from "../../../libs/dal/authority";
import { CustomerModel } from "../../../libs/dal/customer";
import { NotificationModel, NotificationTarget } from "../../../libs/dal/notification";
import {
  PackageTransactionSnapshot,
  PackageTransactionTypeEnum,
} from "../../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../../libs/dal/packageTransaction/package-transaction.model";
import { Context } from "../../../libs/graphql";
import { NotificationBuilder } from "../notification/notificationBuilder";

export default {
  schema: gql`
    input CustomerUpdatePackageFieldInput {
      videoLimit: Int
      imageLimit: Int
      videoCount: Int
      imageCount: Int
      imageStreamCount: Int
      videoStreamCount: Int
      expiryPackageDate: DateTime
    }

    extend type Mutation {
      customerUpdatePackageField(customerId: ID!, data: CustomerUpdatePackageFieldInput!): Customer
    }
  `,
  resolver: {
    Mutation: {
      customerUpdatePackageField: async (root: any, args: any, context: Context) => {
        await context.auth(TOKEN_ROLES.ADMIN_STAFF).grant([Scope["QT-3-3"]]);

        const { customerId, data } = args;

        // Lấy customer hiện tại để snapshot trước khi thay đổi
        const customer = await CustomerModel.findById(customerId).orFail(
          new Error(t("Khách hàng không tồn tại"))
        );

        const pkg = customer.googlePackage || {};

        // Snapshot BEFORE
        const beforeSnapshot: PackageTransactionSnapshot = {
          subscription: pkg.subscription,
          videoCount: pkg.videoCount,
          videoLimit: pkg.videoLimit,
          imageCount: pkg.imageCount,
          imageLimit: pkg.imageLimit,
          imageStreamCount: pkg.imageStreamCount,
          videoStreamCount: pkg.videoStreamCount,
          expiryPackageDate: pkg.expiryPackageDate,
        };

        // Chỉ cập nhật những field được gửi lên (không null/undefined)
        const updateFields: Record<string, any> = {};
        const changedFields: string[] = [];

        if (data.videoLimit !== undefined && data.videoLimit !== null) {
          updateFields["googlePackage.videoLimit"] = data.videoLimit;
          changedFields.push(`videoLimit: ${pkg.videoLimit ?? "N/A"} → ${data.videoLimit}`);
        }
        if (data.imageLimit !== undefined && data.imageLimit !== null) {
          updateFields["googlePackage.imageLimit"] = data.imageLimit;
          changedFields.push(`imageLimit: ${pkg.imageLimit ?? "N/A"} → ${data.imageLimit}`);
        }
        if (data.videoCount !== undefined && data.videoCount !== null) {
          updateFields["googlePackage.videoCount"] = data.videoCount;
          changedFields.push(`videoCount: ${pkg.videoCount ?? "N/A"} → ${data.videoCount}`);
        }
        if (data.imageCount !== undefined && data.imageCount !== null) {
          updateFields["googlePackage.imageCount"] = data.imageCount;
          changedFields.push(`imageCount: ${pkg.imageCount ?? "N/A"} → ${data.imageCount}`);
        }
        if (data.imageStreamCount !== undefined && data.imageStreamCount !== null) {
          updateFields["googlePackage.imageStreamCount"] = data.imageStreamCount;
          changedFields.push(
            `imageStreamCount: ${pkg.imageStreamCount ?? "N/A"} → ${data.imageStreamCount}`
          );
        }
        if (data.videoStreamCount !== undefined && data.videoStreamCount !== null) {
          updateFields["googlePackage.videoStreamCount"] = data.videoStreamCount;
          changedFields.push(
            `videoStreamCount: ${pkg.videoStreamCount ?? "N/A"} → ${data.videoStreamCount}`
          );
        }
        if (data.expiryPackageDate !== undefined && data.expiryPackageDate !== null) {
          updateFields["googlePackage.expiryPackageDate"] = new Date(data.expiryPackageDate);
          changedFields.push(
            `expiryPackageDate: ${pkg.expiryPackageDate ?? "N/A"} → ${data.expiryPackageDate}`
          );
        }

        if (Object.keys(updateFields).length === 0) {
          throw new Error(t("Không có field nào được cập nhật"));
        }

        const updatedCustomer = await CustomerModel.findByIdAndUpdate(
          customerId,
          { $set: updateFields },
          { new: true }
        ).orFail(new Error(t("Cập nhật gói thất bại")));

        const updatedPkg = updatedCustomer.googlePackage || {};

        // Snapshot AFTER
        const afterSnapshot: PackageTransactionSnapshot = {
          subscription: updatedPkg.subscription,
          videoCount: updatedPkg.videoCount,
          videoLimit: updatedPkg.videoLimit,
          imageCount: updatedPkg.imageCount,
          imageLimit: updatedPkg.imageLimit,
          imageStreamCount: updatedPkg.imageStreamCount,
          videoStreamCount: updatedPkg.videoStreamCount,
          expiryPackageDate: updatedPkg.expiryPackageDate,
        };

        // Ghi log PackageTransaction
        await PackageTransactionModel.create({
          customerId: customerId,
          customerCode: customer.code,
          type: PackageTransactionTypeEnum.MANUAL_ADJUST,
          before: beforeSnapshot,
          after: afterSnapshot,
          description: `Admin cập nhật field gói: ${changedFields.join(", ")}`,
        });

        // Tạo thông báo tới customer
        const notifyTitle = `Gói dịch vụ đã được điều chỉnh`;
        const notifyBody = `Các thông số gói của bạn đã được điều chỉnh:\n${changedFields.join(
          "\n"
        )}`;
        const notify = new NotificationBuilder(notifyTitle, notifyBody)
          .sendTo(NotificationTarget.CUSTOMER, customerId)
          .build();
        await NotificationModel.create(notify);

        return updatedCustomer;
      },
    },
  },
};
