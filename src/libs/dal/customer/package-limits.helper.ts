import { SettingModel } from "../setting/setting.model";
import { SubscriptionPlanEnum } from "./customer.interface";

const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.FREE]: "free",
  [SubscriptionPlanEnum.TRIAL]: "trial",
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.ENTERPRISE]: "enterprise",
};

const PLAN_ORDER = Object.values(SubscriptionPlanEnum);

export type PackageLimitsConfig = {
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

/** Load limit mặc định của tất cả gói từ Setting (cache trong 1 query) */
export async function loadAllPackageLimitsFromSettings(): Promise<
  Record<string, PackageLimitsConfig>
> {
  const settings = await SettingModel.find({
    key: { $regex: "^pk-", $options: "i" },
  }).lean();

  const result: Record<string, PackageLimitsConfig> = {};

  for (const plan of PLAN_ORDER) {
    const prefix = `pk-${PLAN_KEY_MAP[plan]}`;
    const getValue = (suffix: string, fallback: number) => {
      const s = settings.find((x) => x.key === `${prefix}-${suffix}`);
      const n = s ? Number(s.value) : fallback;
      return Number.isFinite(n) ? n : fallback;
    };

    const fallback = plan === SubscriptionPlanEnum.FREE ? FREE_LIMITS_FALLBACK : undefined;

    result[plan] = {
      videoLimit: getValue("video-limit", fallback?.videoLimit ?? 0),
      imageLimit: getValue("image-limit", fallback?.imageLimit ?? 0),
      requestLimit: getValue("request-limit", fallback?.requestLimit ?? 0),
      textCreditLimit: getValue("text-credit", fallback?.textCreditLimit ?? 0),
      imageStreamCount: getValue("image-stream-count", fallback?.imageStreamCount ?? 1),
      videoStreamCount: getValue("video-stream-count", fallback?.videoStreamCount ?? 1),
    };
  }

  return result;
}

export function getPackageLimitsForSubscription(
  allLimits: Record<string, PackageLimitsConfig>,
  subscription?: string
): PackageLimitsConfig {
  const plan = subscription || SubscriptionPlanEnum.FREE;
  return allLimits[plan] || allLimits[SubscriptionPlanEnum.FREE] || FREE_LIMITS_FALLBACK;
}

export function applyLimitDelta(
  current: number | undefined,
  delta: number | undefined
): number | undefined {
  if (delta === undefined || delta === null || delta === 0) return undefined;
  const cur = current ?? 0;
  if (cur === -1) return -1;
  return Math.max(-1, cur + delta);
}
