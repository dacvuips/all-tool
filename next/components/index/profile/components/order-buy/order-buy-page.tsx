import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiShoppingBag3Line } from "react-icons/ri";
import { PaymentStatus } from "../../../../../lib/repo/order/order.repo";
import { TabGroup } from "../../../../shared/utilities/tab";
import { ProfileOrderBuyTabs } from "./components/order-buy-tabs";

type OrderCountMap = Record<string, number>;

export function ProfileOrderBuyPage() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<OrderCountMap>({});

  const totalCount = useMemo(
    () => Object.values(counts).reduce((sum, value) => sum + value, 0),
    [counts]
  );

  return (
    <section className="p-2 bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="flex gap-2 items-center px-3 py-2 border-gray-100">
        <RiShoppingBag3Line className="text-xl text-primary" />
        <div>
          <p className="font-semibold text-gray-800">{t("Đơn mua của bạn")}</p>
        </div>
      </div>

      <TabGroup
        onChange={() => undefined}
        activeClassName="text-primary bg-primary-light rounded-lg    "
        hasArrow
        hasInkBar={false}
        tabClassName="px-3 py-2 my-1 border-gray-200 rounded-lg border mx-1"
        className="rounded-lg"
        bodyClassName="py-2"
      >
        <TabGroup.Tab label={t("Tất cả")} count={`${totalCount}`}>
          <ProfileOrderBuyTabs onSummaryChange={setCounts} />
        </TabGroup.Tab>

        <TabGroup.Tab
          label={t("Chờ thanh toán")}
          count={`${counts[PaymentStatus.PAYMENT_PENDING] || 0}`}
        >
          <ProfileOrderBuyTabs
            paymentStatus={PaymentStatus.PAYMENT_PENDING}
            onSummaryChange={setCounts}
          />
        </TabGroup.Tab>

        <TabGroup.Tab
          label={t("Đã thanh toán")}
          count={`${counts[PaymentStatus.PAYMENT_SUCCESS] || 0}`}
        >
          <ProfileOrderBuyTabs
            paymentStatus={PaymentStatus.PAYMENT_SUCCESS}
            onSummaryChange={setCounts}
          />
        </TabGroup.Tab>

        <TabGroup.Tab label={t("Đã hủy")} count={`${counts[PaymentStatus.PAYMENT_CANCELLED] || 0}`}>
          <ProfileOrderBuyTabs
            paymentStatus={PaymentStatus.PAYMENT_CANCELLED}
            onSummaryChange={setCounts}
          />
        </TabGroup.Tab>

        <TabGroup.Tab label={t("Hết hạn")} count={`${counts[PaymentStatus.PAYMENT_TIMEOUT] || 0}`}>
          <ProfileOrderBuyTabs
            paymentStatus={PaymentStatus.PAYMENT_TIMEOUT}
            onSummaryChange={setCounts}
          />
        </TabGroup.Tab>
      </TabGroup>
    </section>
  );
}
