import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { HiOutlineInformationCircle } from "react-icons/hi";
import { Order, PaymentStatus } from "../../../../lib/repo/order/order.repo";
import { Dialog } from "../../../shared/utilities/dialog/dialog";
import { Button } from "../../../shared/utilities/form";
import {
  checkoutTypeQueryParam,
  getPostPaymentSuccessPath,
} from "../utils/checkout-type";

export interface OrderPaymentChangedDialogProps {
  /** Hiển thị/ẩn dialog */
  isOpen: boolean;
  /** Callback khi đóng dialog */
  onClose: () => void;
  /** Thông tin đơn hàng */
  order: Order;
}

/**
 * Dialog thông báo khi trạng thái thanh toán thay đổi
 * - Hiển thị thông tin thanh toán mới
 * - Redirect đến trang orders hoặc home tùy trạng thái
 */
export function OrderPaymentChangedDialog({
  isOpen,
  onClose,
  order,
}: OrderPaymentChangedDialogProps) {
  const { t } = useTranslation();
  const router = useRouter();

  // Mapping trạng thái thanh toán sang thông tin hiển thị
  const getPaymentInfo = (paymentStatus: PaymentStatus) => {
    const successPath = getPostPaymentSuccessPath(order.type);
    const retryPath = `/checkout${checkoutTypeQueryParam(order.type)}`;

    switch (paymentStatus) {
      case PaymentStatus.PAYMENT_SUCCESS:
        return {
          icon: "success" as const,
          title: t("Thanh toán thành công"),
          message:
            order.type === "API_MEDIA"
              ? t("Gói API Media đã được kích hoạt. Bạn có thể lấy API key tại trang API Media.")
              : order.type === "RECAPTCHA"
              ? t("Gói reCAPTCHA đã được kích hoạt. Bạn có thể lấy API key tại trang reCAPTCHA.")
              : order.type === "NORMAL"
              ? t("Nạp mPoint thành công. Số dư ví đã được cập nhật.")
              : t("Thanh toán thành công. Đơn hàng sẽ được cửa hàng tiếp nhận xử lý."),
          redirectPath: successPath,
          confirmText:
            order.type === "API_MEDIA"
              ? t("Đến trang API Media")
              : order.type === "RECAPTCHA"
              ? t("Đến trang reCAPTCHA")
              : order.type === "NORMAL"
              ? t("Về trang chủ")
              : t("Xem đơn hàng"),
        };

      case PaymentStatus.PAYMENT_FAILED:
        return {
          icon: "error" as const,
          title: t("Thanh toán thất bại"),
          message: t(
            "Thanh toán của bạn không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác."
          ),
          redirectPath: retryPath,
          confirmText: t("Thử lại"),
        };

      case PaymentStatus.PAYMENT_CANCELLED:
        return {
          icon: "error" as const,
          title: t("Thanh toán đã bị hủy"),
          message: t("Thanh toán của bạn đã bị hủy. Bạn có thể tạo đơn hàng mới hoặc thử lại."),
          redirectPath: retryPath,
          confirmText: t("Tạo đơn mới"),
        };

      case PaymentStatus.PAYMENT_TIMEOUT:
        return {
          icon: "error" as const,
          title: t("Thanh toán hết hạn"),
          message: `${t("Thời gian thanh toán đã hết")}. ${t(
            "Vui lòng tạo đơn hàng mới hoặc liên hệ hỗ trợ"
          )}.`,
          redirectPath: retryPath,
          confirmText: t("Tạo đơn mới"),
        };

      case PaymentStatus.PAYMENT_REFUNDED:
        return {
          icon: "info" as const,
          title: t("Đã hoàn tiền"),
          message: t("Số tiền đã được hoàn trả vào tài khoản của bạn."),
          redirectPath: "/orders",
          confirmText: t("Xem đơn hàng"),
        };

      case PaymentStatus.PAYMENT_PARTIALLY_REFUNDED:
        return {
          icon: "info" as const,
          title: t("Đã hoàn một phần tiền"),
          message: t("Một phần số tiền đã được hoàn trả vào tài khoản của bạn."),
          redirectPath: "/orders",
          confirmText: t("Xem đơn hàng"),
        };

      default:
        return {
          icon: "info" as const,
          title: t("Cập nhật thanh toán"),
          message: t("Trạng thái thanh toán của đơn hàng đã được cập nhật."),
          redirectPath: "/orders",
          confirmText: t("Xem đơn hàng"),
        };
    }
  };

  const iconPaths = {
    success: (
      <i className="text-3xl text-success">
        <HiOutlineInformationCircle />
      </i>
    ),
    error: (
      <i className="text-3xl text-danger">
        <HiOutlineInformationCircle />
      </i>
    ),
    warning: (
      <i className="text-3xl text-warning">
        <HiOutlineInformationCircle />
      </i>
    ),
    info: (
      <i className="text-3xl text-info">
        <HiOutlineInformationCircle />
      </i>
    ),
  };
  const lottieFilesIcons = {
    success: "/assets/lottie/payment-success.json",
    error: "/assets/lottie/cancel-transaction.json",
  };

  const handleConfirm = () => {
    if (paymentInfo.redirectPath) {
      router.push(paymentInfo.redirectPath);
    }
    onClose?.();
  };

  const paymentInfo = getPaymentInfo(order.paymentStatus);

  return (
    <Dialog
      width="450px"
      maxWidth="90vw"
      isOpen={isOpen}
      hasCloseIcon={false}
      onOverlayClick={handleConfirm}
      title={paymentInfo.title}
    >
      <div className="p-4 text-center">
        {!!lottieFilesIcons[paymentInfo.icon] && (
          <Player
            autoplay
            loop
            src={lottieFilesIcons[paymentInfo.icon]}
            style={{ height: "200px", width: "200px" }}
          ></Player>
        )}
        <div className={`flex flex-row items-start w-full p-2 rounded-lg `}>
          {iconPaths[paymentInfo.icon]}
          {/* Thông báo chính */}
          <span className="lg:text-16 text-14 ">{paymentInfo.message}</span>
        </div>

        <Button
          text={paymentInfo.confirmText || t("Xác nhận")}
          className="mt-2"
          onClick={handleConfirm}
          primary
        />
      </div>
    </Dialog>
  );
}
