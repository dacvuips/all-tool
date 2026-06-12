import { useTranslation } from "react-i18next";
import { parseNumber } from "../../../../lib/helpers/parser";
import { PaymentMethod } from "../../../../lib/repo/order/order.repo";
import { useCheckoutContext } from "../provider/checkout-provider";

export function CheckoutPayment() {
  const { t } = useTranslation();
  const { order, selectPayment } = useCheckoutContext();

  // Extract order information
  const subtotal = order?.totalAmount || 0;
  const shippingFee = 0;
  const tax = 0;
  const discount = order?.discount || 0;
  const totalAmount = order?.totalAmount || 0;
  const paymentMethod = order?.paymentMethod || selectPayment?.value;

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="overflow-hidden bg-white border border-gray-200 rounded-xl">
        {/* Header */}
        <div className="px-2 py-3 bg-gradient-to-r">
          <h3 className="text-lg font-bold tracking-wide text-center uppercase ">
            {t("THÔNG TIN ĐƠN HÀNG")}
          </h3>
        </div>

        {/* Order Details */}
        <div className="p-4">
          <dl className="space-y-4">
            {/* Payment Method */}
            <div className="flex items-center justify-between py-1.5 border-b border-gray-100">
              <dt className="flex items-center text-sm font-medium text-gray-600 sm:text-base">
                <svg
                  className="w-5 h-5 mr-2 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                  />
                </svg>
                {t("Phương thức thanh toán")}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 sm:text-base">
                {paymentMethod ? PaymentMethod[paymentMethod] : t("Chưa chọn")}
              </dd>
            </div>

            {/* Subtotal */}
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-sm font-medium text-gray-600 sm:text-base">{t("Tạm tính")}</dt>
              <dd className="text-sm font-semibold text-gray-900 sm:text-base">
                {parseNumber(subtotal)}đ
              </dd>
            </div>

            {/* Shipping Fee */}
            <div className="flex items-center justify-between py-3">
              <dt className="text-sm font-medium text-gray-600 sm:text-base">
                {t("Phí vận chuyển")}
              </dt>
              <dd className="text-sm font-semibold text-gray-900 sm:text-base">
                {shippingFee === 0 ? (
                  <span className="text-green-600">{t("Miễn phí")}</span>
                ) : (
                  `${parseNumber(shippingFee)}đ`
                )}
              </dd>
            </div>

            {/* Tax */}
            <div className="flex items-center justify-between py-1.5">
              <dt className="text-sm font-medium text-gray-600 sm:text-base">{t("Thuế")}</dt>
              <dd className="text-sm font-semibold text-gray-900 sm:text-base">
                {parseNumber(tax)}đ
              </dd>
            </div>

            {/* Discount */}
            {discount > 0 && (
              <div className="flex items-center justify-between py-1.5">
                <dt className="text-sm font-medium text-gray-600 sm:text-base">{t("Giảm giá")}</dt>
                <dd className="text-sm font-semibold text-red-600 sm:text-base">
                  -{parseNumber(discount)}đ
                </dd>
              </div>
            )}
          </dl>
        </div>

        {/* Total Amount */}
        <div className="p-2 py-5 border-t border-gray-200 bg-gray-50 ">
          <div className="flex items-center justify-between">
            <dt className="flex items-center text-base font-bold text-gray-900 sm:text-lg">
              <svg
                className="w-6 h-6 mr-2 text-primary"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {t("Tổng thanh toán")}
            </dt>
            <dd className="text-2xl font-bold text-primary sm:text-3xl">
              {parseNumber(totalAmount)}đ
            </dd>
          </div>
        </div>

        {/* Order Summary Card */}
        {order?.type === "NORMAL" && order.creditAmount > 0 && (
          <div className="px-4 py-2 border-t border-gray-100">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">{t("mPoint nhận được")}</span>
              <span className="font-semibold text-primary">
                +{parseNumber(order.creditAmount)} mPoint
              </span>
            </div>
          </div>
        )}

        {order && (
          <div className="p-2 border-t border-blue-100 bg-blue-50 ">
            <div className="flex items-start">
              <svg
                className="w-5 h-5 mt-0.5 mr-2 text-blue-600 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-xs text-blue-800 sm:text-sm">
                  {t("Mã đơn hàng")}: <span className="font-semibold">{order.orderNumber}</span>
                </p>
                {order.note && (
                  <p className="mt-1 text-xs text-blue-700 sm:text-sm">
                    {t("Ghi chú")}: {order.note}
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Additional Info */}
      <div className="px-4 py-3 mt-4 border border-yellow-200 rounded-lg bg-yellow-50">
        <div className="flex items-start">
          <svg
            className="w-5 h-5 mt-0.5 mr-2 text-yellow-600 flex-shrink-0"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
          <p className="text-xs text-yellow-800 sm:text-sm">
            {t("Vui lòng kiểm tra kỹ thông tin đơn hàng trước khi thanh toán")}
          </p>
        </div>
      </div>
    </div>
  );
}
