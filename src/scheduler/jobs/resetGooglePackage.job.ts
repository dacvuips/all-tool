import { Job } from "agenda";
import moment from "moment-timezone";

import logger from "../../helpers/logger";
import { CustomerModel } from "../../libs/dal/customer/customer.model";
import { snapshotGooglePackage } from "../../libs/dal/customer/google-package.snapshot";
import { SubscriptionPlanEnum } from "../../libs/dal/customer/customer.interface";
import {
  PackageTransactionTypeEnum,
  PackageTransactionSnapshot,
} from "../../libs/dal/packageTransaction/package-transaction.interface";
import { PackageTransactionModel } from "../../libs/dal/packageTransaction/package-transaction.model";
import { SettingHelper } from "../../packages/setting-helper";
import { Agenda } from "../agenda";

type PackageLimitsConfig = {
  videoLimit: number;
  imageLimit: number;
  requestLimit: number;
  textCreditLimit: number;
  imageStreamCount: number;
  videoStreamCount: number;
};

const FREE_LIMITS_FALLBACK: PackageLimitsConfig = {
  videoLimit: 5,
  imageLimit: 10,
  requestLimit: 5,
  textCreditLimit: 0,
  imageStreamCount: 1,
  videoStreamCount: 1,
};

const PAID_PLANS = new Set<string>(
  Object.values(SubscriptionPlanEnum).filter((plan) => plan !== SubscriptionPlanEnum.FREE)
);

function isPaidPlan(subscription?: string): boolean {
  return !!subscription && PAID_PLANS.has(subscription);
}

function getExpiryDate(pkg: Record<string, any>): Date | null {
  return pkg.expiryPackageDate ? new Date(pkg.expiryPackageDate) : null;
}

/** Gói còn hiệu lực: Free vô thời hạn, gói trả phí (trừ Trial) còn hạn hoặc chưa gán ngày hết hạn */
function isActivePackage(pkg: Record<string, any>, now: Date): boolean {
  if (pkg.subscription === SubscriptionPlanEnum.FREE) return true;
  if (pkg.subscription === SubscriptionPlanEnum.TRIAL) return false;
  if (!isPaidPlan(pkg.subscription)) return false;

  const expiryDate = getExpiryDate(pkg);
  return !expiryDate || expiryDate > now;
}

/** Gói trả phí đã hết hạn (Trial không có ngày hết hạn cũng coi là hết hạn) */
function isExpiredPaidPackage(pkg: Record<string, any>, now: Date): boolean {
  if (!isPaidPlan(pkg.subscription)) return false;

  const expiryDate = getExpiryDate(pkg);
  if (pkg.subscription === SubscriptionPlanEnum.TRIAL) {
    return !expiryDate || expiryDate <= now;
  }
  return !!expiryDate && expiryDate <= now;
}

/** Chuẩn hóa document cũ: $inc có thể tạo googlePackage chỉ có count, không có subscription. */
function normalizeGooglePackage(pkg: Record<string, any> | null | undefined): Record<string, any> {
  const base = pkg || {};
  return {
    ...base,
    subscription: base.subscription ?? SubscriptionPlanEnum.FREE,
  };
}

/** Load limit gói Free từ Setting (chỉ dùng khi hạ gói hết hạn) */
async function loadFreePackageLimitsFromSettings(): Promise<PackageLimitsConfig> {
  const plan = SubscriptionPlanEnum.FREE;
  const keys = [
    `pk-${plan}-video-limit`,
    `pk-${plan}-image-limit`,
    `pk-${plan}-request-limit`,
    `pk-${plan}-text-credit`,
    `pk-${plan}-image-stream-count`,
    `pk-${plan}-video-stream-count`,
  ];

  const values = await SettingHelper.loadMany(keys);
  const num = (index: number, fallback: number) => {
    const n = Number(values[index]);
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    videoLimit: num(0, FREE_LIMITS_FALLBACK.videoLimit),
    imageLimit: num(1, FREE_LIMITS_FALLBACK.imageLimit),
    requestLimit: num(2, FREE_LIMITS_FALLBACK.requestLimit),
    textCreditLimit: num(3, FREE_LIMITS_FALLBACK.textCreditLimit),
    imageStreamCount: num(4, FREE_LIMITS_FALLBACK.imageStreamCount),
    videoStreamCount: num(5, FREE_LIMITS_FALLBACK.videoStreamCount),
  };
}

export type ResetGooglePackageResult = {
  processedCount: number;
  resetCount: number;
  downgradeCount: number;
  skippedTrialCount: number;
  errorCount: number;
};

export class ResetGooglePackageJob {
  static jobName = "ResetGooglePackage";
  /** Job duyệt toàn bộ customer — cần lock dài hơn mặc định 10s */
  static lockLifetime = 10 * 60 * 1000;

  static create(data: any) {
    return Agenda.create(this.jobName, data);
  }

  /** Chạy logic reset (cron hoặc admin trigger thủ công) */
  static async run(now: Date = new Date()): Promise<ResetGooglePackageResult> {
    logger.info(`[${ResetGooglePackageJob.jobName}] Started at ${moment(now).format()}`);

    const freeLimits = await loadFreePackageLimitsFromSettings();
    const freeDefaults = {
      subscription: SubscriptionPlanEnum.FREE,
      videoCount: 0,
      imageCount: 0,
      requestCount: 0,
      textCreditCount: 0,
      ...freeLimits,
    };

    const customers = await CustomerModel.find({
      $or: [
        { googlePackage: { $exists: true } },
        { "googlePackage.imageCount": { $exists: true } },
        { "googlePackage.videoCount": { $exists: true } },
      ],
    }).lean();

    logger.info(
      `[${ResetGooglePackageJob.jobName}] Found ${customers.length} customers to process`
    );

    let resetCount = 0;
    let downgradeCount = 0;
    let skippedTrialCount = 0;
    let errorCount = 0;

    for (const customer of customers) {
      try {
        const pkg = normalizeGooglePackage(customer.googlePackage as Record<string, any>);
        const expiryDate = getExpiryDate(pkg);
        const isTrial = pkg.subscription === SubscriptionPlanEnum.TRIAL;

        // Trial còn hạn: không reset count hàng ngày, giữ nguyên limit, chờ hết hạn mới downgrade
        if (isTrial && expiryDate && expiryDate > now) {
          skippedTrialCount++;
          continue;
        }

        if (isActivePackage(pkg, now)) {
          // Free + gói trả phí (Basic/Standard/...) còn hạn → reset count, giữ nguyên limit hiện có
          await CustomerModel.updateOne(
            { _id: customer._id },
            {
              $set: {
                "googlePackage.subscription": pkg.subscription,
                "googlePackage.videoCount": 0,
                "googlePackage.imageCount": 0,
                "googlePackage.requestCount": 0,
                "googlePackage.textCreditCount": 0,
              },
            }
          );

          const isFree = pkg.subscription === SubscriptionPlanEnum.FREE;
          logger.info(
            `[${ResetGooglePackageJob.jobName}] Reset count cho customer ${customer.code} - gói ${pkg.subscription}${isFree ? "" : expiryDate ? ` (còn hạn đến ${moment(expiryDate).format("DD/MM/YYYY")})` : ""}`
          );

          resetCount++;
        } else if (isExpiredPaidPackage(pkg, now)) {
          // Gói hết hạn → hạ xuống Free với thông số từ settings
          const beforeSnapshot: PackageTransactionSnapshot = snapshotGooglePackage(pkg);

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
                "googlePackage.textCreditCount": freeDefaults.textCreditCount,
                "googlePackage.textCreditLimit": freeDefaults.textCreditLimit,
                "googlePackage.imageStreamCount": freeDefaults.imageStreamCount,
                "googlePackage.videoStreamCount": freeDefaults.videoStreamCount,
              },
              $unset: {
                "googlePackage.expiryPackageDate": "",
              },
            }
          );

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

    const result: ResetGooglePackageResult = {
      processedCount: customers.length,
      resetCount,
      downgradeCount,
      skippedTrialCount,
      errorCount,
    };

    logger.info(
      `[${ResetGooglePackageJob.jobName}] Completed: ${resetCount} reset, ${downgradeCount} downgraded, ${skippedTrialCount} skipped trial, ${errorCount} errors`
    );

    return result;
  }

  static async execute(job: Job) {
    try {
      await ResetGooglePackageJob.run(new Date());
    } catch (err) {
      logger.error(`[${ResetGooglePackageJob.jobName}] Fatal error: ${err.message}`);
    }
  }
}

export default ResetGooglePackageJob;

