import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { Scope } from "../../../libs/dal/authority";
import { CustomerModel } from "../../../libs/dal/customer";
import {
  PackageTransactionTypeEnum,
  PackageTransactionSnapshot,
} from "../../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../../libs/dal/packageTransaction/package-transaction.model";
import { Context } from "../../../libs/graphql";

export default {
  schema: gql`
    extend type Mutation {
      customerUpdatePackage(customerId: ID!, data: GooglePackageInput!): Customer
    }
  `,
  resolver: {
    Mutation: {
      customerUpdatePackage: async (root: any, args: any, context: Context) => {
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

        // Cập nhật googlePackage
        const updateFields: Record<string, any> = {};
        if (data.subscription !== undefined)
          updateFields["googlePackage.subscription"] = data.subscription;
        if (data.videoLimit !== undefined)
          updateFields["googlePackage.videoLimit"] = data.videoLimit;
        if (data.imageLimit !== undefined)
          updateFields["googlePackage.imageLimit"] = data.imageLimit;
        if (data.imageStreamCount !== undefined)
          updateFields["googlePackage.imageStreamCount"] = data.imageStreamCount;
        if (data.videoStreamCount !== undefined)
          updateFields["googlePackage.videoStreamCount"] = data.videoStreamCount;
        if (data.videoCount !== undefined)
          updateFields["googlePackage.videoCount"] = data.videoCount;
        if (data.imageCount !== undefined)
          updateFields["googlePackage.imageCount"] = data.imageCount;
        if (data.expiryPackageDate !== undefined)
          updateFields["googlePackage.expiryPackageDate"] = data.expiryPackageDate;

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
          description: `Admin cập nhật gói: ${beforeSnapshot.subscription || "N/A"} → ${afterSnapshot.subscription || "N/A"}`,
        });

        return updatedCustomer;
      },
    },
  },
};
