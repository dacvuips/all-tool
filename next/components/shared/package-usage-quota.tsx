import { useRef } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../lib/providers/auth-provider";
import { SubscriptionPlanEnum } from "../../lib/repo/customer/customer.repo";
import {
  formatSubscription,
  getPackageClasses,
  getPackageStyle,
  GooglePackagePopoverContent,
} from "../admin/management/customer/components/customer-google-package-cell";
import { Popover } from "./utilities/popover/popover";

export function PackageUsageQuota() {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const packageRef = useRef();
  const subscription = customer?.googlePackage?.subscription;
  const packageStyle = getPackageStyle(subscription || SubscriptionPlanEnum.TRIAL);
  const packageClasses = getPackageClasses(packageStyle);
  const subscriptionLabel = subscription ? formatSubscription(subscription) : t("Dùng thử");

  return (
    <>
      <div
        ref={packageRef}
        className={`flex overflow-hidden items-center h-8 text-sm rounded-lg cursor-default ${packageClasses.container}`}
      >
        <span className={`px-2.5 font-semibold whitespace-nowrap ${packageStyle.text}`}>
          {t("Gói")}: <span className="uppercase">{subscriptionLabel}</span>
        </span>
      </div>
      <Popover reference={packageRef} trigger="hover" placement="bottom" arrow maxWidth={320}>
        <GooglePackagePopoverContent googlePackage={customer?.googlePackage} />
      </Popover>
    </>
  );
}
