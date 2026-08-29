import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../../lib/helpers/parser";
import {
  GooglePackage,
  SubscriptionPlanEnum,
} from "../../../../../lib/repo/customer/customer.repo";
import { Popover } from "../../../../shared/utilities/popover/popover";

type PackageStyle = {
  text: string;
  border: string;
  background: string;
  divider: string;
  progress: string;
};

const SUBSCRIPTION_STYLE: Record<SubscriptionPlanEnum, PackageStyle> = {
  [SubscriptionPlanEnum.FREE]: {
    text: "text-gray-600",
    border: "border-gray-600",
    background: "bg-slate-50",
    divider: "border-gray-200",
    progress: "bg-gray-600",
  },
  [SubscriptionPlanEnum.TRIAL]: {
    text: "text-gray-700",
    border: "border-gray-700",
    background: "bg-gray-50",
    divider: "border-gray-200",
    progress: "bg-gray-700",
  },
  [SubscriptionPlanEnum.BASIC]: {
    text: "text-blue-600",
    border: "border-blue-600",
    background: "bg-blue-50",
    divider: "border-blue-200",
    progress: "bg-blue-600",
  },
  [SubscriptionPlanEnum.STANDARD]: {
    text: "text-primary",
    border: "border-primary",
    background: "bg-primary-light",
    divider: "border-primary/30",
    progress: "bg-primary",
  },
  [SubscriptionPlanEnum.PROFESSIONAL]: {
    text: "text-green-600",
    border: "border-green-600",
    background: "bg-green-50",
    divider: "border-green-200",
    progress: "bg-green-600",
  },
  [SubscriptionPlanEnum.ENTERPRISE]: {
    text: "text-yellow-600",
    border: "border-yellow-600",
    background: "bg-yellow-50",
    divider: "border-yellow-200",
    progress: "bg-yellow-600",
  },
};

export function getPackageClasses(style: PackageStyle) {
  return {
    container: `border ${style.border} ${style.background}`,
    badge: style.text,
    divider: `border-t ${style.divider}`,
    dividerBottom: `border-b ${style.divider}`,
  };
}

export function getPackageStyle(subscription?: string): PackageStyle {
  return (
    SUBSCRIPTION_STYLE[subscription as SubscriptionPlanEnum] ??
    SUBSCRIPTION_STYLE[SubscriptionPlanEnum.FREE]
  );
}

export function formatSubscription(subscription?: string) {
  if (!subscription) return "—";
  return subscription.charAt(0).toUpperCase() + subscription.slice(1);
}

function UsageRow({
  label,
  count = 0,
  limit = 0,
  progressClass = "bg-primary",
}: {
  label: string;
  count?: number;
  limit?: number;
  progressClass?: string;
}) {
  const unlimited = limit === -1;
  const pct = !unlimited && limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  return (
    <div className="text-xs">
      <div className="flex justify-between gap-2 text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {count}
          <span className="text-gray-400 font-normal"> / {unlimited ? "∞" : limit}</span>
        </span>
      </div>
      {!unlimited && limit > 0 && (
        <div className="mt-0.5 h-1 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : progressClass}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
}

export function GooglePackagePopoverContent({ googlePackage }: { googlePackage?: GooglePackage }) {
  const { t } = useTranslation();
  const pkg = googlePackage;
  const subscription = pkg?.subscription || SubscriptionPlanEnum.FREE;
  const packageStyle = getPackageStyle(subscription);
  const packageClasses = getPackageClasses(packageStyle);
  const expiryDate = pkg?.expiryPackageDate;
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
  const expiryText = expiryDate
    ? formatDate(expiryDate, "HH:mm dd-MM-yyyy")
    : t("Chưa có thời hạn");

  return (
    <div
      className={`p-3 text-sm space-y-2 min-w-[16rem] rounded-lg ${packageClasses.container}`}
    >
      <div className={`font-semibold pb-2 ${packageClasses.dividerBottom} ${packageStyle.text}`}>
        {t("Chi tiết gói Google")}
      </div>
      <div className="flex justify-between gap-3 text-gray-600">
        <span className="shrink-0">{t("Gói")}</span>
        <span className={`text-xs font-semibold uppercase ${packageClasses.badge}`}>
          {formatSubscription(subscription)}
        </span>
      </div>
      <DetailRow
        label={t("Video")}
        value={`${pkg?.videoCount ?? 0} / ${pkg?.videoLimit ?? 0}`}
      />
      <DetailRow label={t("Ảnh")} value={`${pkg?.imageCount ?? 0} / ${pkg?.imageLimit ?? 0}`} />
      <DetailRow
        label={t("Generation text")}
        value={`${pkg?.requestCount ?? 0} / ${pkg?.requestLimit ?? 0}`}
      />
      <DetailRow
        label={t("Voice Credit")}
        value={`${pkg?.textCreditCount ?? 0} / ${pkg?.textCreditLimit === -1 ? "∞" : pkg?.textCreditLimit ?? 0}`}
      />
      <DetailRow label={t("Luồng video đồng thời")} value={pkg?.videoStreamCount ?? 0} />
      <DetailRow label={t("Luồng ảnh đồng thời")} value={pkg?.imageStreamCount ?? 0} />
      <DetailRow
        label={t("Ngày hết hạn gói")}
        value={expiryText}
        className={isExpired ? "text-red-600 font-semibold" : undefined}
      />
    </div>
  );
}

export function CustomerGooglePackageCell({ googlePackage }: { googlePackage?: GooglePackage }) {
  const { t } = useTranslation();
  const ref = useRef<HTMLDivElement>(null);

  if (!googlePackage) {
    return <span className="text-sm text-gray-400">—</span>;
  }

  const pkg = googlePackage;
  const subscription = pkg.subscription || SubscriptionPlanEnum.FREE;
  const packageStyle = getPackageStyle(subscription);
  const packageClasses = getPackageClasses(packageStyle);
  const expiryDate = pkg.expiryPackageDate;
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
  const expiryText = expiryDate
    ? formatDate(expiryDate, "HH:mm dd-MM-yyyy")
    : t("Chưa có thời hạn");

  return (
    <>
      <div
        ref={ref}
        className={`min-w-[11rem] max-w-[14rem] cursor-default rounded-lg p-2 text-left ${packageClasses.container}`}
      >
        <span className={`text-xs font-semibold uppercase ${packageClasses.badge}`}>
          {formatSubscription(subscription)}
        </span>
        <div className={`mt-1.5 pt-1.5 space-y-1 ${packageClasses.divider}`}>
          <UsageRow
            label={t("Video")}
            count={pkg.videoCount}
            limit={pkg.videoLimit}
            progressClass={packageStyle.progress}
          />
          <UsageRow
            label={t("Ảnh")}
            count={pkg.imageCount}
            limit={pkg.imageLimit}
            progressClass={packageStyle.progress}
          />
          <UsageRow
            label={t("Text")}
            count={pkg.requestCount}
            limit={pkg.requestLimit}
            progressClass={packageStyle.progress}
          />
          <UsageRow
            label={t("Voice Credit")}
            count={pkg.textCreditCount}
            limit={pkg.textCreditLimit}
            progressClass={packageStyle.progress}
          />
        </div>
        <div
          className={`mt-1.5 pt-1.5 text-xs truncate ${packageClasses.divider} ${isExpired ? "text-red-600 font-medium" : "text-gray-500"}`}
          title={expiryText}
        >
          {isExpired ? t("Hết hạn") : t("HSD")}: {expiryText}
        </div>
      </div>

      <Popover reference={ref} trigger="hover" placement="left" arrow maxWidth={320}>
        <GooglePackagePopoverContent googlePackage={pkg} />
      </Popover>
    </>
  );
}

function DetailRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string | number;
  className?: string;
}) {
  return (
    <div className="flex justify-between gap-3 text-gray-600">
      <span className="shrink-0">{label}</span>
      <span className={`font-medium text-gray-900 text-right ${className}`}>{value}</span>
    </div>
  );
}
