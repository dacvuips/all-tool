import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiShoppingCart, HiTrash } from "react-icons/hi";
import { RiArrowDropLeftFill, RiArrowDropRightFill } from "react-icons/ri";
import { useOptionsTranslation } from "../../../lib/hooks/useOptionsTranslate";
import { useCart } from "../../../lib/providers/cart-provider";
import { useCheckoutContext } from "../../index/checkout/provider/checkout-provider";
import { Button } from "../../shared/utilities/form";
import { Img } from "../../shared/utilities/misc";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { Spinner } from "../utilities/misc";

import { OrderInfo } from "../order/order-info";

interface CartDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement>;
}

export function CartDropdown({ isOpen, onClose, anchorRef }: CartDropdownProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { cartItems, loading, removeItem: removeItemFromCart, refreshCart } = useCart();
  const [removing, setRemoving] = useState<string | null>(null);
  // Orders tab state
  const { order, loading: orderLoading } = useCheckoutContext();
  // Import ImageQRBank
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { ImageQRBank } = require("../../index/checkout/checkout-page");

  // Thời gian còn lại cho đơn hàng (giống logic checkout-page)
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 30, seconds: 0, expired: false });
  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const createdTime = new Date(order.createdAt).getTime();
      const expiry = createdTime + 30 * 60 * 1000;
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds, expired: false });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [order]);

  const { PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();
  useEffect(() => {
    if (isOpen) {
      refreshCart();
    }
  }, [isOpen]);

  const handleRemoveItem = async (itemId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      setRemoving(itemId);
      await removeItemFromCart(itemId);
    } catch (error) {
      console.error("Remove item error:", error);
    } finally {
      setRemoving(null);
    }
  };

  const handleViewCart = () => {
    onClose();
    router.push("/cart");
  };

  const handleCheckout = () => {
    onClose();
    router.push("/cart");
  };

  const totalAmount = cartItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItems = cartItems.reduce((sum, item) => sum + item.quantity, 0);
  // Tổng số sản phẩm trong đơn hàng hiện tại
  const totalOrder = order ? 1 : 0;
  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 lg:hidden" onClick={onClose} />

      {/* Dropdown with TabGroup */}
      <div className="fixed inset-0 lg:absolute lg:inset-auto lg:top-full lg:right-0 z-50 lg:mt-2 w-full lg:w-96 bg-white lg:rounded-lg lg:shadow-xl lg:border max-h-screen lg:max-h-[600px] flex flex-col">
        <TabGroup
          tabClassName="py-4"
          activeClassName="text-primary"
          hasInkBar
          bodyClassName="h-scrollbar"
          index={!!order ? 1 : 0}
        >
          <TabGroup.Tab label={t("Giỏ hàng") + (totalItems > 0 ? ` (${totalItems})` : "")}>
            {/* Cart Tab Content */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex justify-center items-center h-40">
                  <Spinner />
                </div>
              ) : cartItems.length === 0 ? (
                <div className="flex flex-col justify-center items-center h-40 text-gray-400">
                  <HiShoppingCart className="mb-2 w-16 h-16" />
                  <p>{t("Giỏ hàng trống")}</p>
                </div>
              ) : (
                <div className="divide-y">
                  {cartItems.slice(0, 5).map((item) => (
                    <div
                      key={item.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        removing === item.id ? "opacity-50" : ""
                      }`}
                    >
                      <div className="flex gap-3">
                        <Img
                          src={item.thumbnail}
                          className="object-cover flex-shrink-0 w-16 h-16 rounded"
                          alt={item.productName}
                        />
                        <div className="flex-1 min-w-0">
                          <h4 className="text-sm font-medium text-gray-800 truncate">
                            {item.productName}
                          </h4>
                          {item.variantName && (
                            <p className="text-xs text-gray-500 truncate">{item.variantName}</p>
                          )}
                          <div className="flex justify-between items-center mt-2">
                            <span className="font-semibold text-primary">
                              {item.price.toLocaleString()}đ
                            </span>
                            <span className="text-sm text-gray-600">x{item.quantity}</span>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleRemoveItem(item.id, e)}
                          disabled={removing === item.id}
                          className="text-gray-400 transition-colors hover:text-red-500 disabled:opacity-50"
                        >
                          <HiTrash className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}

                  {cartItems.length > 5 && (
                    <div className="p-3 text-sm text-center text-gray-500">
                      {t("và")} {cartItems.length - 5} {t("sản phẩm khác")}
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Cart Footer */}
            {cartItems.length > 0 && (
              <div className="p-4 space-y-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">{t("Tổng cộng")}:</span>
                  <span className="text-lg font-bold text-primary">
                    {totalAmount.toLocaleString()}đ
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    outline
                    className="flex-1"
                    text={t("Xem giỏ hàng")}
                    onClick={handleViewCart}
                  />
                  <Button
                    primary
                    className="flex-1"
                    text={t("Thanh toán")}
                    onClick={handleCheckout}
                  />
                </div>
              </div>
            )}
          </TabGroup.Tab>
          <TabGroup.Tab label={t("Đơn hàng") + (totalOrder > 0 ? ` (${totalOrder})` : "")}>
            {/* Order Tab Content - To be implemented next */}
            <div className="overflow-y-auto flex-1">
              {orderLoading ? (
                <div className="flex justify-center items-center h-40">
                  <Spinner />
                </div>
              ) : !order ? (
                <div className="flex flex-col justify-center items-center h-40 text-gray-400">
                  <HiShoppingCart className="mb-2 w-16 h-16" />
                  <p>{t("Không có đơn hàng nào đang lên đơn")}</p>
                </div>
              ) : (
                <div
                  className="p-4 cursor-pointer hover:bg-gray-50"
                  onClick={() => {
                    router.push("/checkout");
                  }}
                >
                  {/* Đơn hàng UI đẹp và chuẩn */}

                  {/* Order Info (reusable component) */}
                  <OrderInfo order={order} PAYMENT_STATUS_OPTIONS={PAYMENT_STATUS_OPTIONS} t={t} />
                  {/* Sản phẩm trong đơn hàng */}
                  {/* Thông tin thanh toán */}
                  {order.paymentInfo && (
                    <div className="mt-3 border-t">
                      {/* Thêm mã QR chuyển khoản */}
                      <div className="mt-4">
                        {/* Hiển thị thời gian còn lại giống checkout-page */}
                        <div className="flex flex-col justify-center items-center mt-4">
                          <span className="pb-2 text-sm text-center text-gray-500">
                            {t("Thời gian còn lại để xác nhận thanh toán")}
                          </span>
                          <div className="flex flex-row gap-4">
                            <div className="flex flex-col justify-center items-center p-2 bg-green-100 rounded-md">
                              <div className="text-lg font-bold text-green-800">
                                {timeRemaining.minutes}
                              </div>
                              <div className="text-green-800">{t("Phút")}</div>
                            </div>
                            <div className="flex flex-col justify-center items-center p-2 bg-green-100 rounded-md">
                              <div className="text-lg font-bold text-green-800">
                                {timeRemaining.seconds}
                              </div>
                              <div className="text-green-800">{t("Giây")}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Nút chuyển đến trang orders */}
              <div className="flex justify-between my-1.5">
                <Button
                  text={t("Xem tất cả đơn")}
                  onClick={() => {
                    onClose();
                    router.push("/profile/orders-buy");
                  }}
                  iconPosition="start"
                  iconClassName="text-xl"
                  icon={<RiArrowDropLeftFill />}
                  className="min-w-[160px] rounded-none"
                />
                <div style={{ width: "1px" }} className="h-10 bg-gray-200" />
                {/* Khoảng cách giữa hai nút */}
                {!!order && (
                  <Button
                    text={t("Xem đơn này")}
                    onClick={() => {
                      onClose();
                      router.push("/checkout");
                    }}
                    iconPosition="end"
                    iconClassName="text-xl"
                    icon={<RiArrowDropRightFill />}
                    className="min-w-[160px] rounded-none"
                  />
                )}
              </div>
            </div>
          </TabGroup.Tab>
        </TabGroup>
      </div>
    </>
  );
}
