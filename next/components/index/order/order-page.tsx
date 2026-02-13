import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiChevronDown, HiChevronUp, HiShoppingBag } from "react-icons/hi";
import { useOptionsTranslation } from "../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { Order, OrderStatus, orderService } from "../../../lib/repo/order/order.repo";
import { SortDirection } from "../../../lib/repo/types";
import { OrderStatusTimeline } from "../../admin/management/order/components";
import { OrderSection } from "../../admin/management/order/components/order-section";
import { Button } from "../../shared/utilities/form";
import { Card, Spinner } from "../../shared/utilities/misc";
import { StatusLabel } from "../../shared/utilities/misc/status-label";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { OrderProductsList } from "./components";

// Định nghĩa các tab filter theo hình ảnh
interface OrderTabFilter {
  label: string;
  value: string;
  statuses?: OrderStatus[]; // Danh sách trạng thái để filter
}

export const OrdersGuestPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const router = useRouter();
  const { customer } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]); // Danh sách orders theo tab
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const { ORDER_STATUS_OPTIONS } = useOptionsTranslation();

  const ITEMS_PER_PAGE = 20;

  // Cấu hình các tab dựa vào hình ảnh
  const orderTabs: OrderTabFilter[] = [
    { label: t("Tất cả"), value: "all" },
    { label: t("Chờ thanh toán"), value: "pending", statuses: [OrderStatus.CREATED] },
    { label: t("Vận chuyển"), value: "shipping", statuses: [OrderStatus.SHIPPING_STARTED] },
    {
      label: t("Chờ giao hàng"),
      value: "processing",
      statuses: [OrderStatus.PROCESSING, OrderStatus.CONFIRMED],
    },
    { label: t("Hoàn thành"), value: "completed", statuses: [OrderStatus.DELIVERED] },
    { label: t("Đã hủy"), value: "cancelled", statuses: [OrderStatus.CANCELLED] },
  ];

  // Load orders khi tab thay đổi hoặc component mount
  useEffect(() => {
    if (customer !== undefined) {
      setCurrentPage(1);
      loadOrders(activeTab, 1, false);
    }
  }, [customer, activeTab]);

  // Load orders từ server theo tab được chọn
  const loadOrders = async (tabValue: string, page: number = 1, append: boolean = false) => {
    try {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      // Tìm tab config để lấy statuses filter
      const tab = orderTabs.find((t) => t.value === tabValue);

      // Build query filter
      const queryFilter: any = {
        order: { createdAt: SortDirection.Desc },
        limit: ITEMS_PER_PAGE,
        offset: (page - 1) * ITEMS_PER_PAGE,
      };

      // Nếu không phải tab "Tất cả", thêm filter status
      if (tabValue !== "all" && tab?.statuses && tab.statuses.length > 0) {
        queryFilter.filter = {
          status: { __in: tab.statuses },
        };
      }

      const response = await orderService.getOrdersByGuest({
        query: queryFilter,
        cache: false, // Không sử dụng cache, luôn lấy data mới từ server
      });

      const newOrders = response.data || [];

      if (append) {
        setOrders((prev) => [...prev, ...newOrders]);
      } else {
        setOrders(newOrders);
      }

      // Check if there are more items to load
      setHasMore(newOrders.length === ITEMS_PER_PAGE);
      setHasSearched(true);
    } catch (error: any) {
      console.error("Load orders error:", error);
      toast.error(error.message || t("Không thể tải danh sách đơn hàng"));
      if (!append) {
        setOrders([]);
      }
    } finally {
      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Handle tab change - useEffect sẽ tự động gọi loadOrders
  const handleTabChange = (tabValue: string) => {
    setActiveTab(tabValue);
  };

  // Handle load more
  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    loadOrders(activeTab, nextPage, true);
  };

  const toggleOrderExpansion = (orderId: string) => {
    const newExpanded = new Set(expandedOrders);
    if (newExpanded.has(orderId)) {
      newExpanded.delete(orderId);
    } else {
      newExpanded.add(orderId);
    }
    setExpandedOrders(newExpanded);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Component hiển thị danh sách orders (tái sử dụng)
  const renderOrdersList = (orders: Order[]) => {
    if (orders.length === 0) {
      return (
        <Card className="py-12 text-center">
          <HiShoppingBag className="w-16 h-16 mx-auto mb-4 text-gray-400" />
          <h3 className="mb-2 text-lg font-semibold text-gray-900">
            {t("Không tìm thấy đơn hàng")}
          </h3>
          <p className="text-gray-600">{t("Bạn chưa có đơn hàng nào trong mục này")}</p>
        </Card>
      );
    }

    return (
      <div className="flex flex-col space-y-4 gap-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="relative p-2 transition-shadow duration-200 bg-white border rounded-md hover:shadow hover:border-primary"
          >
            {/* Order Header */}
            <div className="flex flex-col border-gray-200 cursor-pointer">
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <span className="font-semibold text-gray-900">
                    {t("Đơn hàng")}: #{order.orderNumber}
                  </span>
                  <StatusLabel
                    value={order.status}
                    options={ORDER_STATUS_OPTIONS}
                    className="px-3 py-1 text-xs rounded-md"
                  />
                </div>
              </div>
            </div>
            {/* Order Items with Show More */}
            <OrderProductsList items={order.items || []} product={order.product} />
            <div className="pt-4 ">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">
                    {`${t("Tạm tính")} (${order.items.length} ${t("sản phẩm")})`}:
                  </span>
                  <span className="text-gray-900">{formatCurrency(order.subtotal)}</span>
                </div>
                {order.shippingFee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("Phí vận chuyển")}:</span>
                    <span className="text-gray-900">{formatCurrency(order.shippingFee)}</span>
                  </div>
                )}
                {order.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">{t("Thuế")}:</span>
                    <span className="text-gray-900">{formatCurrency(order.tax)}</span>
                  </div>
                )}
                {order.discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>{t("Giảm giá")}:</span>
                    <span>-{formatCurrency(order.discount)}</span>
                  </div>
                )}
                <div className="flex justify-between pt-2 text-base border-t border-gray-200">
                  <span className="font-bold text-gray-900">{t("Tổng cộng")}:</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(order.totalAmount)}
                  </span>
                </div>
              </div>
            </div>
            {/* Order Details - Expandable */}
            {expandedOrders.has(order.id) && (
              <div className="pt-4 space-y-4">
                {/* Order Summary */}

                {/* 3 Columns: Shipping Address, Payment Info, Order History */}
                <div className="grid grid-cols-1 gap-2 pt-4 lg:grid-cols-3">
                  {/* Shipping Address */}
                  <div>
                    <OrderSection title={t("Địa chỉ giao hàng")} sticky>
                      <div className="p-2 space-y-2 text-sm rounded-lg">
                        <p className="flex items-center">
                          <label className="text-gray-600">{t("Tên người nhận")}:</label>
                          <p className="font-medium text-gray-900">
                            {order.shippingAddress?.recipientName || "-"}
                          </p>
                        </p>
                        <p className="flex items-center">
                          <label className="text-gray-600">{t("Số điện thoại")}:</label>
                          <p className="font-medium text-gray-900">
                            {order.shippingAddress?.phone || "-"}
                          </p>
                        </p>
                        {order.shippingAddress?.email && (
                          <p className="flex items-center">
                            <label className="text-gray-600">{t("Email")}:</label>
                            <p className="font-medium text-gray-900">
                              {order.shippingAddress.email}
                            </p>
                          </p>
                        )}
                        <p className="flex items-center">
                          <label className="text-gray-600">{t("Địa chỉ")}:</label>
                          <p className="font-medium text-gray-900">
                            {order.shippingAddress?.address}
                            {order.shippingAddress?.ward && `, ${order.shippingAddress.ward}`}
                            {order.shippingAddress?.district &&
                              `, ${order.shippingAddress.district}`}
                            {order.shippingAddress?.province &&
                              `, ${order.shippingAddress.province}`}
                          </p>
                        </p>
                        {order.shippingAddress?.note && (
                          <p className="flex items-center">
                            <label className="text-gray-600">{t("Ghi chú")}:</label>
                            <p className="font-medium text-gray-900">
                              {order.shippingAddress.note}
                            </p>
                          </p>
                        )}
                      </div>
                    </OrderSection>
                  </div>

                  {/* Payment Info */}
                  <OrderSection title={t("Thông tin thanh toán")} sticky>
                    <div className="space-y-2 text-sm rounded-lg">
                      <div className="flex justify-between">
                        <span className="text-gray-600">{t("Phương thức")}:</span>
                        <span className="font-medium text-gray-900">
                          {order.paymentMethod === "BANK" ? t("Chuyển khoản") : order.paymentMethod}
                        </span>
                      </div>
                      {order.paymentInfo?.bankName && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">{t("Ngân hàng")}:</span>
                            <span className="font-medium text-gray-900">
                              {order.paymentInfo.bankName}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">{t("Số TK")}:</span>
                            <span className="font-medium text-gray-900">
                              {order.paymentInfo.accountNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-gray-600">{t("Chủ TK")}:</span>
                            <span className="font-medium text-gray-900">
                              {order.paymentInfo.accountName}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </OrderSection>

                  {/* Order History */}
                  <OrderStatusTimeline order={order} />
                </div>

                {/* Customer Note */}
                {order.customerNote && (
                  <div className="pt-4 border-t border-gray-200">
                    <h4 className="mb-2 text-sm font-semibold text-gray-900">{t("Ghi chú")}</h4>
                    <p className="p-3 text-sm text-gray-600 rounded-lg bg-yellow-50">
                      {order.customerNote}
                    </p>
                  </div>
                )}
              </div>
            )}
            <div
              onClick={() => toggleOrderExpansion(order.id)}
              className="absolute z-10 flex items-center justify-center gap-2 transform translate-x-1/2 -bottom-5 right-1/2 left-1/2"
            >
              <div className="relative flex p-1 py-0.5 text-center bg-white border-b rounded-b-lg cursor-pointer hover:border-primary whitespace-nowrap">
                {expandedOrders.has(order.id) ? (
                  <span className="text-sm text-gray-600">{t("Thu gọn")}</span>
                ) : (
                  <span className="text-sm text-gray-600">{t("Xem chi tiết")}</span>
                )}

                <div>
                  {expandedOrders.has(order.id) ? (
                    <HiChevronUp className="w-5 h-5 text-primary" />
                  ) : (
                    <HiChevronDown className="w-5 h-5 text-primary" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
  
        {/* Load More Button */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              outline
              onClick={handleLoadMore}
              disabled={loadingMore}
              textPrimary
              icon={loadingMore ? <Spinner className="w-4 h-4" /> : <HiChevronDown />}
            >
              {loadingMore ? (
                <span className="flex items-center gap-2">{t("Đang tải")}...</span>
              ) : (
                t("Tải thêm")
              )}
            </Button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2 text-3xl font-bold text-gray-900">{t("Đơn hàng của tôi")}</h1>
          <p className="text-gray-600">{t("Quản lý và theo dõi tất cả đơn hàng của bạn")}</p>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        )}

        {/* Tabs với Orders List */}
        {!loading && hasSearched && (
          <TabGroup
            name="orders"
            className="border border-gray-200 "
            tabClassName="p-3 text-sm font-medium transition-colors  "
            activeClassName="text-primary p-2"
            bodyClassName="py-4"
            hasArrow
            onChange={(index) => handleTabChange(orderTabs[index].value)}
          >
            {orderTabs.map((tab) => (
              <TabGroup.Tab key={tab.value} label={tab.label}>
                {renderOrdersList(orders)}
              </TabGroup.Tab>
            ))}
          </TabGroup>
        )}
      </div>
    </div>
  );
};
