import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CgSpinner } from "react-icons/cg";
import { RiRefreshLine, RiSearchLine, RiShoppingCart2Line } from "react-icons/ri";
import { useScreen } from "../../../../../../lib/hooks/useScreen";
import { useAuth } from "../../../../../../lib/providers/auth-provider";
import { Order, orderService, PaymentStatus } from "../../../../../../lib/repo/order/order.repo";
import { Button, Input } from "../../../../../shared/utilities/form";
import { NotFound } from "../../../../../shared/utilities/misc";
import { OrderBuyItem } from "./order-buy-item";

interface Props {
  paymentStatus?: PaymentStatus;
  onSummaryChange?: (summary: Record<string, number>) => void;
}

export function ProfileOrderBuyTabs({ paymentStatus, onSummaryChange }: Props) {
  const { t } = useTranslation();
  const md = useScreen("md");
  const { customer } = useAuth();
  const timeoutRef = useRef<any>(null);

  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [textSearch, setTextSearch] = useState<string>(undefined);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Keep one loading flow for search + pagination to avoid flicker.
  const getOrders = async () => {
    if (!customer) return;
    setIsLoading(true);
    try {
      const response = await orderService.getMyOrders(100);
      const nextOrders = Array.isArray(response) ? response : [];
      setOrders(nextOrders);

      // Send summary to parent for tab counters.
      const summary = nextOrders.reduce((acc, item) => {
        const key = item.paymentStatus || "UNKNOWN";
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      onSummaryChange?.(summary);
    } catch (error) {
      setOrders([]);
      onSummaryChange?.({});
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!customer) return;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => {
        getOrders();
      },
      textSearch ? 500 : 0
    );
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [customer]);

  useEffect(() => {
    const keyword = (textSearch || "").toLowerCase().trim();
    const nextFiltered = orders.filter((item) => {
      const matchStatus = paymentStatus ? item.paymentStatus === paymentStatus : true;
      const orderNumber = (item.orderNumber || "").toLowerCase();
      const productName = (item.items?.[0]?.productName || "").toLowerCase();
      const matchText = keyword
        ? orderNumber.includes(keyword) || productName.includes(keyword)
        : true;
      return matchStatus && matchText;
    });
    setFilteredOrders(nextFiltered);
  }, [orders, paymentStatus, textSearch]);

  const onRefresh = async () => {
    await getOrders();
  };

  if (!isLoading && filteredOrders.length === 0) {
    return (
      <div className="p-4 mt-3 bg-white rounded-xl border border-gray-100">
        <NotFound icon={<RiShoppingCart2Line />} text={t("Bạn chưa có đơn hàng nào")} />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-row gap-2 mb-3">
        <div className="flex-1">
          <Input
            debounce
            clearable={md}
            placeholder={`${t("Tìm mã đơn hoặc tên sản phẩm")}...`}
            prefix={
              <i className="text-xl text-gray-400">
                <RiSearchLine />
              </i>
            }
            suffix={
              isLoading && (
                <i className="-right-0 transition animate-spin text-primary">
                  <CgSpinner />
                </i>
              )
            }
            onChange={(value) => setTextSearch(value || undefined)}
          />
        </div>
        <Button
          className="bg-white border-gray-200 hover:bg-gray-50"
          onClick={onRefresh}
          tooltip={t("Làm mới")}
          outline
          icon={<RiRefreshLine className="text-20" />}
        />
      </div>

      <div className="space-y-3">
        {filteredOrders.map((order, index) => (
          <OrderBuyItem key={index} order={order} loadAll={onRefresh} />
        ))}
      </div>
    </>
  );
}
