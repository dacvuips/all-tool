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
import { SettingHelper } from "../../packages/setting-helper";
import { Agenda } from "../agenda";

/** Lấy thông số gói Free từ Setting (không hardcode) */
async function loadFreePackageDefaults() {
  const plan = SubscriptionPlanEnum.FREE;
  const [videoLimit, imageLimit, requestLimit, imageStreamCount, videoStreamCount] =
    await SettingHelper.loadMany([
      `pk-${plan}-video-limit`,
      `pk-${plan}-image-limit`,
      `pk-${plan}-request-limit`,
      `pk-${plan}-image-stream-count`,
      `pk-${plan}-video-stream-count`,
    ]);

  return {
    subscription: SubscriptionPlanEnum.FREE,
    videoCount: 0,
    videoLimit: Number(videoLimit) || 5,
    imageCount: 0,
    imageLimit: Number(imageLimit) || 10,
    requestCount: 0,
    requestLimit: Number(requestLimit) || 5,
    imageStreamCount: Number(imageStreamCount) || 1,
    videoStreamCount: Number(videoStreamCount) || 1,
  };
}

export class ResetGooglePackageJob {
  static jobName = "ResetGooglePackage";

  static create(data: any) {
    return Agenda.create(this.jobName, data);
  }

  static async execute(job: Job) {
    const now = new Date();
    logger.info(`[${ResetGooglePackageJob.jobName}] Started at ${moment(now).format()}`);

    try {
      // Lấy thông số gói Free từ settings
      const freeDefaults = await loadFreePackageDefaults();

      // Lấy tất cả customer có gói Google (bao gồm Trial)
      const customers = await CustomerModel.find({
        "googlePackage.subscription": { $exists: true },
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
          const isTrial = pkg.subscription === SubscriptionPlanEnum.TRIAL;
          const isFree = pkg.subscription === SubscriptionPlanEnum.FREE;
          const expiryDate = pkg.expiryPackageDate ? new Date(pkg.expiryPackageDate) : null;

          // Trial còn hạn: không reset count hàng ngày, chờ hết hạn mới downgrade
          if (isTrial && expiryDate && expiryDate > now) {
            continue;
          }

          if (isFree || (expiryDate && expiryDate > now)) {
            // Gói Free hoặc gói còn hạn → chỉ reset count về 0
            const updateSet: Record<string, any> = {
              "googlePackage.videoCount": 0,
              "googlePackage.imageCount": 0,
              "googlePackage.requestCount": 0,
            };

            // Nếu là gói Free, đồng bộ lại limit từ settings
            if (isFree) {
              updateSet["googlePackage.videoLimit"] = freeDefaults.videoLimit;
              updateSet["googlePackage.imageLimit"] = freeDefaults.imageLimit;
              updateSet["googlePackage.requestLimit"] = freeDefaults.requestLimit;
              updateSet["googlePackage.imageStreamCount"] = freeDefaults.imageStreamCount;
              updateSet["googlePackage.videoStreamCount"] = freeDefaults.videoStreamCount;
            }

            await CustomerModel.updateOne(
              { _id: customer._id },
              { $set: updateSet }
            );

            logger.info(
              `[${ResetGooglePackageJob.jobName}] Reset count cho customer ${customer.code} - gói ${pkg.subscription}${isFree ? "" : ` (còn hạn đến ${moment(expiryDate).format("DD/MM/YYYY")})`}`
            );

            resetCount++;
          } else {
            // Gói hết hạn → hạ xuống Free với thông số từ settings
            const beforeSnapshot: PackageTransactionSnapshot = {
              subscription: pkg.subscription,
              videoCount: pkg.videoCount,
              videoLimit: pkg.videoLimit,
              imageCount: pkg.imageCount,
              imageLimit: pkg.imageLimit,
              requestCount: pkg.requestCount,
              requestLimit: pkg.requestLimit,
              imageStreamCount: pkg.imageStreamCount,
              videoStreamCount: pkg.videoStreamCount,
              expiryPackageDate: pkg.expiryPackageDate,
            };

            const afterSnapshot: PackageTransactionSnapshot = {
              ...freeDefaults,
              expiryPackageDate: undefined,
            };

            await CustomerModel.updateOne(
              { _id: customer._id },
              {
                $set: {
                  "googlePackage.subscription": freeDefaults.subscription,
                  "googlePackage.videoCount": freeDefaults.videoCount,
                  "googlePackage.videoLimit": freeDefaults.videoLimit,
                  "googlePackage.imageCount": freeDefaults.imageCount,
                  "googlePackage.imageLimit": freeDefaults.imageLimit,
                  "googlePackage.requestCount": freeDefaults.requestCount,
                  "googlePackage.requestLimit": freeDefaults.requestLimit,
                  "googlePackage.imageStreamCount": freeDefaults.imageStreamCount,
                  "googlePackage.videoStreamCount": freeDefaults.videoStreamCount,
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

