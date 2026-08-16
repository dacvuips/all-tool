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

const PACKAGE_PLANS = Object.values(SubscriptionPlanEnum);

const PAID_PLANS = new Set<string>(
  PACKAGE_PLANS.filter((plan) => plan !== SubscriptionPlanEnum.FREE)
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

/** Load toàn bộ limit gói từ Setting (một lần mỗi lần chạy job) */
async function loadAllPackageLimitsFromSettings(): Promise<Map<string, PackageLimitsConfig>> {
  const keys: string[] = [];
  for (const plan of PACKAGE_PLANS) {
    keys.push(
      `pk-${plan}-video-limit`,
      `pk-${plan}-image-limit`,
      `pk-${plan}-request-limit`,
      `pk-${plan}-text-credit`,
      `pk-${plan}-image-stream-count`,
      `pk-${plan}-video-stream-count`
    );
  }

  const values = await SettingHelper.loadMany(keys);
  const byKey = new Map(keys.map((k, i) => [k, values[i]]));
  const num = (plan: string, suffix: string, fallback = 0) => {
    const raw = byKey.get(`pk-${plan}-${suffix}`);
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  };

  const result = new Map<string, PackageLimitsConfig>();
  for (const plan of PACKAGE_PLANS) {
    const fallback = plan === SubscriptionPlanEnum.FREE ? FREE_LIMITS_FALLBACK : null;
    result.set(plan, {
      videoLimit: num(plan, "video-limit", fallback?.videoLimit ?? 0),
      imageLimit: num(plan, "image-limit", fallback?.imageLimit ?? 0),
      requestLimit: num(plan, "request-limit", fallback?.requestLimit ?? 0),
      textCreditLimit: num(plan, "text-credit", fallback?.textCreditLimit ?? 0),
      imageStreamCount: num(plan, "image-stream-count", fallback?.imageStreamCount ?? 0),
      videoStreamCount: num(plan, "video-stream-count", fallback?.videoStreamCount ?? 0),
    });
  }
  return result;
}

function buildLimitUpdateSet(limits: PackageLimitsConfig): Record<string, number> {
  return {
    "googlePackage.videoLimit": limits.videoLimit,
    "googlePackage.imageLimit": limits.imageLimit,
    "googlePackage.requestLimit": limits.requestLimit,
    "googlePackage.textCreditLimit": limits.textCreditLimit,
    "googlePackage.imageStreamCount": limits.imageStreamCount,
    "googlePackage.videoStreamCount": limits.videoStreamCount,
  };
}

function limitsChanged(pkg: Record<string, any>, limits: PackageLimitsConfig): boolean {
  return (
    pkg.videoLimit !== limits.videoLimit ||
    pkg.imageLimit !== limits.imageLimit ||
    pkg.requestLimit !== limits.requestLimit ||
    pkg.textCreditLimit !== limits.textCreditLimit ||
    pkg.imageStreamCount !== limits.imageStreamCount ||
    pkg.videoStreamCount !== limits.videoStreamCount
  );
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
      const packageLimitsByPlan = await loadAllPackageLimitsFromSettings();
      const freeLimits = packageLimitsByPlan.get(SubscriptionPlanEnum.FREE)!;
      const freeDefaults = {
        subscription: SubscriptionPlanEnum.FREE,
        videoCount: 0,
        imageCount: 0,
        requestCount: 0,
        textCreditCount: 0,
        ...freeLimits,
      };

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
          const expiryDate = getExpiryDate(pkg);
          const planLimits = packageLimitsByPlan.get(pkg.subscription);
          const isTrial = pkg.subscription === SubscriptionPlanEnum.TRIAL;

          // Trial còn hạn: không reset count hàng ngày, chờ hết hạn mới downgrade
          if (isTrial && expiryDate && expiryDate > now) {
            if (planLimits && limitsChanged(pkg, planLimits)) {
              await CustomerModel.updateOne(
                { _id: customer._id },
                { $set: buildLimitUpdateSet(planLimits) }
              );
              logger.info(
                `[${ResetGooglePackageJob.jobName}] Đồng bộ limit từ settings cho customer ${customer.code} - gói ${pkg.subscription}`
              );
            }
            continue;
          }

          if (isActivePackage(pkg, now)) {
            // Free + gói trả phí (Basic/Standard/...) còn hạn → reset count + đồng bộ limit từ settings
            const updateSet: Record<string, any> = {
              "googlePackage.videoCount": 0,
              "googlePackage.imageCount": 0,
              "googlePackage.requestCount": 0,
              "googlePackage.textCreditCount": 0,
            };

            if (planLimits) {
              Object.assign(updateSet, buildLimitUpdateSet(planLimits));
            }

            await CustomerModel.updateOne({ _id: customer._id }, { $set: updateSet });

            const limitsSynced = planLimits && limitsChanged(pkg, planLimits);
            const isFree = pkg.subscription === SubscriptionPlanEnum.FREE;
            logger.info(
              `[${ResetGooglePackageJob.jobName}] Reset count${limitsSynced ? " + đồng bộ limit từ settings" : ""} cho customer ${customer.code} - gói ${pkg.subscription}${isFree ? "" : expiryDate ? ` (còn hạn đến ${moment(expiryDate).format("DD/MM/YYYY")})` : ""}`
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

