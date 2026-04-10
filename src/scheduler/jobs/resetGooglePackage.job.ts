import { Job } from "agenda";
import moment from "moment-timezone";

import logger from "../../helpers/logger";
import { CustomerModel } from "../../libs/dal/customer/customer.model";
import { SubscriptionPlanEnum } from "../../libs/dal/customer/customer.interface";
import {
  PackageTransactionTypeEnum,
  PackageTransactionSnapshot,
} from "../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../libs/dal/packageTransaction/package-transaction.model";
import { Agenda } from "../agenda";

/** Giá trị mặc định khi hạ xuống gói Free */
const FREE_PACKAGE_DEFAULTS = {
  subscription: SubscriptionPlanEnum.FREE,
  videoCount: 0,
  videoLimit: 5,
  imageCount: 0,
  imageLimit: 10,
  imageStreamCount: 1,
  videoStreamCount: 1,
};

export class ResetGooglePackageJob {
  static jobName = "ResetGooglePackage";

  static create(data: any) {
    return Agenda.create(this.jobName, data);
  }

  static async execute(job: Job) {
    const now = new Date();
    logger.info(`[${ResetGooglePackageJob.jobName}] Started at ${moment(now).format()}`);

    try {
      // Lấy tất cả customer có subscription KHÔNG phải Free và Trial
      const customers = await CustomerModel.find({
        "googlePackage.subscription": {
          $nin: [SubscriptionPlanEnum.FREE, SubscriptionPlanEnum.TRIAL],
        },
      }).lean();

      logger.info(
        `[${ResetGooglePackageJob.jobName}] Found ${customers.length} customers to process`
      );

      let resetCount = 0;
      let downgradeCount = 0;
      let errorCount = 0;

      for (const customer of customers) {
        try {
          const pkg = customer.googlePackage || {};
          const expiryDate = pkg.expiryPackageDate ? new Date(pkg.expiryPackageDate) : null;

          // Snapshot trước khi thay đổi
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

          if (expiryDate && expiryDate > now) {
            // Gói còn hạn → reset count về 0
            const afterSnapshot: PackageTransactionSnapshot = {
              ...beforeSnapshot,
              videoCount: 0,
              imageCount: 0,
            };

            await CustomerModel.updateOne(
              { _id: customer._id },
              {
                $set: {
                  "googlePackage.videoCount": 0,
                  "googlePackage.imageCount": 0,
                },
              }
            );

            // Ghi log transaction
            await PackageTransactionModel.create({
              customerId: customer._id.toString(),
              customerCode: customer.code,
              type: PackageTransactionTypeEnum.DAILY_RESET_COUNT,
              before: beforeSnapshot,
              after: afterSnapshot,
              description: `Reset daily usage count cho gói ${pkg.subscription} (còn hạn đến ${moment(expiryDate).format("DD/MM/YYYY")})`,
            });

            resetCount++;
          } else {
            // Gói hết hạn → hạ xuống Free với thông số mặc định
            const afterSnapshot: PackageTransactionSnapshot = {
              ...FREE_PACKAGE_DEFAULTS,
              expiryPackageDate: undefined,
            };

            await CustomerModel.updateOne(
              { _id: customer._id },
              {
                $set: {
                  "googlePackage.subscription": FREE_PACKAGE_DEFAULTS.subscription,
                  "googlePackage.videoCount": FREE_PACKAGE_DEFAULTS.videoCount,
                  "googlePackage.videoLimit": FREE_PACKAGE_DEFAULTS.videoLimit,
                  "googlePackage.imageCount": FREE_PACKAGE_DEFAULTS.imageCount,
                  "googlePackage.imageLimit": FREE_PACKAGE_DEFAULTS.imageLimit,
                  "googlePackage.imageStreamCount": FREE_PACKAGE_DEFAULTS.imageStreamCount,
                  "googlePackage.videoStreamCount": FREE_PACKAGE_DEFAULTS.videoStreamCount,
                },
                $unset: {
                  "googlePackage.expiryPackageDate": "",
                },
              }
            );

            // Ghi log transaction
            await PackageTransactionModel.create({
              customerId: customer._id.toString(),
              customerCode: customer.code,
              type: PackageTransactionTypeEnum.EXPIRED_DOWNGRADE,
              before: beforeSnapshot,
              after: afterSnapshot,
              description: `Gói ${pkg.subscription} đã hết hạn${expiryDate ? ` (${moment(expiryDate).format("DD/MM/YYYY")})` : ""} → chuyển về Free`,
            });

            downgradeCount++;
          }
        } catch (err) {
          errorCount++;
          logger.error(
            `[${ResetGooglePackageJob.jobName}] Error processing customer ${customer._id}: ${err.message}`
          );
        }
      }

      logger.info(
        `[${ResetGooglePackageJob.jobName}] Completed: ${resetCount} reset, ${downgradeCount} downgraded, ${errorCount} errors`
      );
    } catch (err) {
      logger.error(`[${ResetGooglePackageJob.jobName}] Fatal error: ${err.message}`);
    }
  }
}

export default ResetGooglePackageJob;
