import { SubscriptionPlanEnum } from "../../../../lib/repo/customer/customer.repo";

export type PlanMeta = {
  label: string;
  icon: string;
  accentColor: string;
  accentBg: string;
  borderActive: string;
  highlight?: boolean;
  badgeLabel?: string;
};

const DEFAULT_META: PlanMeta = {
  label: "Gói",
  icon: "📦",
  accentColor: "text-gray-800",
  accentBg: "bg-gray-50",
  borderActive: "border-gray-400",
};

/** Metadata hiển thị plan card — dùng chung tool / recaptcha / api-media (key lowercase). */
export function buildPlanMeta(t: (key: string) => string): Record<string, PlanMeta> {
  return {
    [SubscriptionPlanEnum.BASIC]: {
      label: t("Gói Cơ Bản"),
      icon: "⭐",
      accentColor: "text-blue-600",
      accentBg: "bg-blue-50",
      borderActive: "border-blue-500",
      badgeLabel: t("Phổ biến"),
    },
    [SubscriptionPlanEnum.STANDARD]: {
      label: t("Gói Tiêu Chuẩn"),
      icon: "⚡",
      accentColor: "text-primary",
      accentBg: "bg-gray-100",
      borderActive: "border-primary",
      highlight: true,
      badgeLabel: "Hot",
    },
    [SubscriptionPlanEnum.PROFESSIONAL]: {
      label: t("Gói Chuyên Nghiệp"),
      icon: "🚀",
      accentColor: "text-green-600",
      accentBg: "bg-green-50",
      borderActive: "border-green-500",
      badgeLabel: t("Chuyên nghiệp"),
    },
    [SubscriptionPlanEnum.ENTERPRISE]: {
      label: t("Gói Enterprise"),
      icon: "💎",
      accentColor: "text-yellow-600",
      accentBg: "bg-yellow-50",
      borderActive: "border-yellow-500",
      badgeLabel: t("Best Value"),
    },
    unlimited: {
      label: t("Gói Unlimited"),
      icon: "💎",
      accentColor: "text-yellow-600",
      accentBg: "bg-yellow-50",
      borderActive: "border-yellow-500",
      badgeLabel: t("Best Value"),
    },
  };
}

export function getPlanMeta(planMetaMap: Record<string, PlanMeta>, plan: string): PlanMeta {
  return planMetaMap[plan] ?? { ...DEFAULT_META, label: plan };
}
