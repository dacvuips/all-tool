import { gql } from "apollo-server-express";
import { TOKEN_ROLES } from "../../../constants/role.const";
import { t } from "../../../helpers/functions/string";
import { Scope } from "../../../libs/dal/authority";
import { CustomerModel } from "../../../libs/dal/customer";
import { SubscriptionPlanEnum } from "../../../libs/dal/customer/customer.interface";
import {
  applyLimitDelta,
  getPackageLimitsForSubscription,
  loadAllPackageLimitsFromSettings,
} from "../../../libs/dal/customer/package-limits.helper";
import { snapshotGooglePackage } from "../../../libs/dal/customer/google-package.snapshot";
import {
  PackageTransactionSnapshot,
  PackageTransactionTypeEnum,
} from "../../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../../libs/dal/packageTransaction/package-transaction.model";
import { Context } from "../../../libs/graphql";

type BulkUpdateInput = {
  customerIds?: string[];
  applyToFilter?: boolean;
  filter?: Record<string, any>;
  resetToPackageDefaults?: boolean;
  videoLimitDelta?: number;
  imageLimitDelta?: number;
  requestLimitDelta?: number;
  textCreditLimitDelta?: number;
  imageStreamCountDelta?: number;
  videoStreamCountDelta?: number;
};

function buildCustomerQuery(input: BulkUpdateInput): Record<string, any> {
  if (input.customerIds?.length) {
    return { _id: { $in: input.customerIds } };
  }
  if (input.applyToFilter) {
    return { ...(input.filter || {}) };
  }
  throw new Error(t("Vui lòng chọn khách hàng hoặc bật áp dụng theo bộ lọc"));
}

function hasDeltaChanges(input: BulkUpdateInput): boolean {
  return [
    input.videoLimitDelta,
    input.imageLimitDelta,
    input.requestLimitDelta,
    input.textCreditLimitDelta,
    input.imageStreamCountDelta,
    input.videoStreamCountDelta,
  ].some((v) => v !== undefined && v !== null && v !== 0);
}

export default {
  schema: gql`
    input CustomerBulkUpdatePackageLimitsInput {
      customerIds: [ID!]
      applyToFilter: Boolean
      filter: Mixed
      resetToPackageDefaults: Boolean
      videoLimitDelta: Int
      imageLimitDelta: Int
      requestLimitDelta: Int
      textCreditLimitDelta: Int
      imageStreamCountDelta: Int
      videoStreamCountDelta: Int
    }

    type CustomerBulkUpdatePackageLimitsResult {
      processedCount: Int!
      updatedCount: Int!
      errorCount: Int!
    }

    extend type Mutation {
      """
      Cập nhật hạn mức gói hàng loạt: cộng/trừ limit hoặc reset về mặc định theo gói hiện tại của từng KH.
      """
      customerBulkUpdatePackageLimits(
        input: CustomerBulkUpdatePackageLimitsInput!
      ): CustomerBulkUpdatePackageLimitsResult
    }
  `,
  resolver: {
    Mutation: {
      customerBulkUpdatePackageLimits: async (_root: any, args: any, context: Context) => {
        await context.auth([TOKEN_ROLES.ADMIN]).grant([Scope["QT-3-3"]]);

        const input: BulkUpdateInput = args.input;

        if (!input.resetToPackageDefaults && !hasDeltaChanges(input)) {
          throw new Error(t("Vui lòng nhập giá trị cộng/trừ hoặc chọn reset limit"));
        }

        const query = buildCustomerQuery(input);
        const customers = await CustomerModel.find(query).lean();
        const allPlanLimits = await loadAllPackageLimitsFromSettings();

        let updatedCount = 0;
        let errorCount = 0;

        for (const customer of customers) {
          try {
            const pkg = (customer.googlePackage || {}) as Record<string, any>;
            const beforeSnapshot: PackageTransactionSnapshot = snapshotGooglePackage(pkg);
            const updateFields: Record<string, any> = {};
            const changedFields: string[] = [];

            if (input.resetToPackageDefaults) {
              const subscription = pkg.subscription || SubscriptionPlanEnum.FREE;
              const defaults = getPackageLimitsForSubscription(allPlanLimits, subscription);

              const limitFields: (keyof typeof defaults)[] = [
                "videoLimit",
                "imageLimit",
                "requestLimit",
                "textCreditLimit",
                "imageStreamCount",
                "videoStreamCount",
              ];

              for (const key of limitFields) {
                const newVal = defaults[key];
                const oldVal = pkg[key];
                if (oldVal !== newVal) {
                  updateFields[`googlePackage.${key}`] = newVal;
                  changedFields.push(`${key}: ${oldVal ?? "N/A"} → ${newVal}`);
                }
              }
            } else {
              const deltas: { key: string; delta?: number }[] = [
                { key: "videoLimit", delta: input.videoLimitDelta },
                { key: "imageLimit", delta: input.imageLimitDelta },
                { key: "requestLimit", delta: input.requestLimitDelta },
                { key: "textCreditLimit", delta: input.textCreditLimitDelta },
                { key: "imageStreamCount", delta: input.imageStreamCountDelta },
                { key: "videoStreamCount", delta: input.videoStreamCountDelta },
              ];

              for (const { key, delta } of deltas) {
                const newVal = applyLimitDelta(pkg[key], delta);
                if (newVal !== undefined && newVal !== pkg[key]) {
                  updateFields[`googlePackage.${key}`] = newVal;
                  changedFields.push(`${key}: ${pkg[key] ?? "N/A"} → ${newVal}`);
                }
              }
            }

            if (Object.keys(updateFields).length === 0) continue;

            await CustomerModel.updateOne({ _id: customer._id }, { $set: updateFields });

            const afterPkg = { ...pkg, ...Object.fromEntries(
              Object.entries(updateFields).map(([k, v]) => [k.replace("googlePackage.", ""), v])
            )};
            const afterSnapshot: PackageTransactionSnapshot = snapshotGooglePackage(afterPkg);

            await PackageTransactionModel.create({
              customerId: customer._id.toString(),
              customerCode: customer.code,
              type: PackageTransactionTypeEnum.MANUAL_ADJUST,
              before: beforeSnapshot,
              after: afterSnapshot,
              description: input.resetToPackageDefaults
                ? `Admin reset limit về mặc định gói ${pkg.subscription || "free"}`
                : `Admin cập nhật limit hàng loạt: ${changedFields.join(", ")}`,
            });

            updatedCount++;
          } catch {
            errorCount++;
          }
        }

        return {
          processedCount: customers.length,
          updatedCount,
          errorCount,
        };
      },
    },
  },
};
