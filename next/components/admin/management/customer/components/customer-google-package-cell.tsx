import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../../lib/helpers/parser";
import { GooglePackage } from "../../../../../lib/repo/customer/customer.repo";
import { Popover } from "../../../../shared/utilities/popover/popover";

const SUBSCRIPTION_BADGE: Record<string, string> = {
  free: "bg-gray-100 text-gray-700",
  trial: "bg-gray-200 text-gray-800",
  basic: "bg-blue-100 text-blue-800",
  standard: "bg-green-100 text-green-800",
  professional: "bg-purple-100 text-purple-800",
  enterprise: "bg-yellow-100 text-yellow-900",
};

function formatSubscription(subscription?: string) {
  if (!subscription) return "—";
  return subscription.charAt(0).toUpperCase() + subscription.slice(1);
}

function UsageRow({
  label,
  count = 0,
  limit = 0,
}: {
  label: string;
  count?: number;
  limit?: number;
}) {
  const pct = limit > 0 ? Math.min((count / limit) * 100, 100) : 0;
  return (
    <div className="text-xs">
      <div className="flex justify-between gap-2 text-gray-600">
        <span>{label}</span>
        <span className="font-medium text-gray-900 whitespace-nowrap">
          {count}
          <span className="text-gray-400 font-normal"> / {limit}</span>
        </span>
      </div>
      {limit > 0 && (
        <div className="mt-0.5 h-1 rounded-full bg-gray-200 overflow-hidden">
          <div
            className={`h-full rounded-full ${pct >= 100 ? "bg-red-500" : "bg-primary"}`}
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
  const subscription = pkg?.subscription || "free";
  const expiryDate = pkg?.expiryPackageDate;
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
  const expiryText = expiryDate
    ? formatDate(expiryDate, "HH:mm dd-MM-yyyy")
    : t("Chưa có thời hạn");

  return (
    <div className="p-3 text-sm space-y-2 min-w-[16rem]">
      <div className="font-semibold text-gray-800 border-b border-gray-100 pb-2">
        {t("Chi tiết gói Google")}
      </div>
      <DetailRow label={t("Gói")} value={formatSubscription(subscription)} />
      <DetailRow
        label={t("Video")}
        value={`${pkg?.videoCount ?? 0} / ${pkg?.videoLimit ?? 0}`}
      />
      <DetailRow label={t("Ảnh")} value={`${pkg?.imageCount ?? 0} / ${pkg?.imageLimit ?? 0}`} />
      <DetailRow
        label={t("Generation text")}
        value={`${pkg?.requestCount ?? 0} / ${pkg?.requestLimit ?? 0}`}
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
  const subscription = pkg.subscription || "free";
  const badgeClass = SUBSCRIPTION_BADGE[subscription] || SUBSCRIPTION_BADGE.free;
  const expiryDate = pkg.expiryPackageDate;
  const isExpired = expiryDate ? new Date(expiryDate) < new Date() : false;
  const expiryText = expiryDate
    ? formatDate(expiryDate, "HH:mm dd-MM-yyyy")
    : t("Chưa có thời hạn");

  return (
    <>
      <div
        ref={ref}
        className="min-w-[11rem] max-w-[14rem] cursor-default rounded-lg border border-gray-200 bg-gray-50 p-2 text-left"
      >
        <span
          className={`inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase ${badgeClass}`}
        >
          {formatSubscription(subscription)}
        </span>
        <div className="mt-1.5 space-y-1">
          <UsageRow label={t("Video")} count={pkg.videoCount} limit={pkg.videoLimit} />
          <UsageRow label={t("Ảnh")} count={pkg.imageCount} limit={pkg.imageLimit} />
          <UsageRow label={t("Text")} count={pkg.requestCount} limit={pkg.requestLimit} />
        </div>
        <div
          className={`mt-1.5 text-xs truncate ${isExpired ? "text-red-600 font-medium" : "text-gray-500"}`}
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
