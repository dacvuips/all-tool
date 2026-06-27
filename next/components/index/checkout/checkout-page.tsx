import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../lib/providers/auth-provider";
import { CheckoutProvider, useCheckoutContext } from "./provider/checkout-provider";

import { Player } from "@lottiefiles/react-lottie-player";
import copy from "copy-to-clipboard";
import { useRouter } from "next/router";
import { HiOutlineCheckCircle, HiOutlineInformationCircle, HiOutlineXCircle } from "react-icons/hi";
import { RiFileCopy2Line } from "react-icons/ri";
import { parseNumber } from "../../../lib/helpers/parser";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { orderService, PaymentMethod, PaymentStatus } from "../../../lib/repo/order/order.repo";
import { VideoDialog } from "../../shared/common/video-dialog";
import { Button } from "../../shared/utilities/form";
import { Spinner } from "../../shared/utilities/misc";
import { CheckoutNormalPaymentForm } from "./components/checkout-normal-payment-form";
import { CheckoutPayment } from "./components/checkout-payment";
import { CheckoutPaymentForm } from "./components/checkout-payment-form";
import { PendingOrderMismatchView } from "./components/pending-order-mismatch-view";
import {
  checkoutTypeQueryParam,
  getPostPaymentSuccessPath,
  hasCheckoutTypeMismatch,
  isPendingOrder,
  orderTypeToCheckoutUrlType,
  SubscriptionOrderType,
} from "./utils/checkout-type";

export function CheckoutPage() {
  return (
    <>
      <CheckoutProvider>
        <CheckoutComponent />
      </CheckoutProvider>
    </>
  );
}

/**
 * Component chính của trang checkout.
 * Xử lý 3 trạng thái:
 * 1. Chưa đặt đơn / đơn mới tạo → Hiển thị form chọn credit + phương thức
 * 2. Đơn đang chờ thanh toán ngân hàng → Hiển thị QR và thông tin CK
 * 3. Đang xử lý / đã thanh toán qua SePay PG → Hiển thị trạng thái SePay PG
 */
function CheckoutComponent() {
  const { order } = useCheckoutContext();
  const { customer } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  const router = useRouter();

  // Lấy thông tin payment callback từ URL (sau khi redirect về từ SePay PG)
  const paymentStatus = router.query.payment as string; // success | error | cancel
  const orderNumberFromUrl = router.query.orderNumber as string;

  useEffect(() => {
    if (customer === null) {
      toast.error(t("Vui lòng đăng nhập để tiếp tục"));
      router.replace("/");
    }
  }, [customer]);

  if (!customer) return <Spinner />;

  const urlType = router.query.type as string | undefined;

  // Nếu redirect về từ SePay PG (có query param ?payment=...)
  if (paymentStatus && orderNumberFromUrl) {
    return <SePayPGCallbackView paymentStatus={paymentStatus} orderNumber={orderNumberFromUrl} />;
  }

  // Nạp mPoint — tách luồng, không lẫn với subscription
  if (urlType === "normal") {
    if (order && hasCheckoutTypeMismatch(order, "normal")) {
      return <PendingOrderMismatchView pendingOrder={order} requestedUrlType="normal" />;
    }
    if (order?.type === "NORMAL" && isPendingOrder(order)) {
      return <PendingOrderCheckoutLayout />;
    }
    return <CheckoutNormalPaymentForm />;
  }

  // Subscription: URL yêu cầu loại khác với đơn pending → chặn (chỉ khi có ?type= rõ ràng)
  if (order && isPendingOrder(order)) {
    if (urlType && hasCheckoutTypeMismatch(order, urlType)) {
      return <PendingOrderMismatchView pendingOrder={order} requestedUrlType={urlType} />;
    }
    return <PendingOrderCheckoutLayout />;
  }

  // Chưa có đơn pending → form chọn gói
  return <CheckoutPaymentForm />;
}

/** Layout chung khi có đơn PAYMENT_PENDING (SePay PG hoặc chuyển khoản) */
function PendingOrderCheckoutLayout() {
  const { order } = useCheckoutContext();

  return (
    <div className="flex flex-col pb-10 bg-gray-100">
      <div className="container px-2 mx-auto sm:px-4">
        <div className="flex flex-col-reverse gap-3 lg:grid lg:grid-cols-12">
          <div className="col-span-full md:col-span-5 lg:col-span-4">
            <CheckoutPayment />
          </div>
          <div className="col-span-full md:col-span-7 lg:col-span-8">
            {order?.paymentMethod === PaymentMethod.SEPAY_PG ? (
              <SePayPGWaitingView />
            ) : (
              <CheckoutPaymentPay />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * View hiển thị khi đơn đang chờ thanh toán qua SePay PG.
 * Xử lý cả 2 trường hợp:
 *  - Vừa submit form → đang chuyển hướng (retrying = false)
 *  - Khách quay lại trang sau khi bỏ SePay / refresh → cho phép thử lại hoặc hủy đơn
 */
function SePayPGWaitingView() {
  const { t } = useTranslation();
  const { order } = useCheckoutContext();
  const router = useRouter();
  const toast = useToast();
  const alert = useAlert();

  const [retrying, setRetrying] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 30, seconds: 0, expired: false });

  // Đồng hồ đếm ngược dựa trên thời điểm order được cập nhật
  useEffect(() => {
    if (!order) return;
    const interval = setInterval(() => {
      const now = Date.now();
      const base = new Date(order.updatedAt).getTime();
      const expiry = base + 30 * 60 * 1000;
      const diff = expiry - now;
      if (diff <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
        clearInterval(interval);
      } else {
        setTimeRemaining({
          minutes: Math.floor(diff / 60000),
          seconds: Math.floor((diff % 60000) / 1000),
          expired: false,
        });
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [order]);

  // Tái tạo form và submit lại tới SePay
  const handleRetry = async () => {
    if (!order?.id) return;
    setRetrying(true);
    try {
      const data =
        order?.type === "NORMAL"
          ? await orderService.createNormalSePayPGCheckout(order.totalAmount, order.id)
          : await orderService.createSePayPGCheckout(
              order.subscriptionPlan,
              order.id,
              orderTypeToCheckoutUrlType(order.type)
            );
      const formFields: Record<string, string> = JSON.parse(data.formFieldsJson);
      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.checkoutUrl;
      Object.entries(formFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("Lỗi tái tạo checkout:", err);
      toast.error(t("Không thể kết nối cổng. Vui lòng thử lại."));
      setRetrying(false);
    }
  };

  const handleCancel = () => {
    alert.warn(
      t("XÁC NHẬN HỦY ĐƠN?"),
      t("Bạn có chắc chắn muốn hủy đơn hàng này không?"),
      t("Có, hủy đơn"),
      async () => {
        await orderService
          .cancelOrder(order.id)
          .then(() => {
            toast.success(t("Hủy đơn thành công"));
            router.reload();
          })
          .catch(() => toast.error(t("Hủy đơn thất bại")));
        return true;
      }
    );
  };

  if (retrying) {
    return (
      <div className="flex flex-col justify-center items-center p-8 min-h-[300px] bg-white rounded-md">
        <Spinner />
        <p className="mt-4 font-semibold text-gray-700">
          {t("Đang chuyển đến cổng thanh toán...")}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-6 bg-white rounded-md min-h-[300px]">
      {/* Tiêu đề */}
      <div className="flex gap-3 items-center pb-2 border-b border-gray-100">
        <div className="flex flex-shrink-0 justify-center items-center w-10 h-10 bg-blue-100 rounded-full">
          <HiOutlineInformationCircle className="text-xl text-blue-600" />
        </div>
        <div>
          <h3 className="font-bold text-gray-800">{t("Đơn hàng đang chờ thanh toán")}</h3>
          <p className="text-sm text-gray-500">{order?.orderNumber}</p>
        </div>
      </div>

      {/* Đồng hồ đếm ngược */}
      {timeRemaining.expired ? (
        <div className="p-3 text-sm font-medium text-center text-red-700 bg-red-50 rounded-lg">
          {t("Đơn hàng đã hết hạn thanh toán. Vui lòng hủy và tạo đơn mới.")}
        </div>
      ) : (
        <div className="flex flex-col gap-2 items-center">
          <p className="text-sm text-gray-500">{t("Thời gian còn lại")}</p>
          <div className="flex gap-3">
            <div className="flex flex-col justify-center items-center p-3 bg-blue-50 rounded-lg min-w-[64px]">
              <span className="text-2xl font-bold text-blue-700">{timeRemaining.minutes}</span>
              <span className="text-xs text-blue-600">{t("Phút")}</span>
            </div>
            <div className="flex flex-col justify-center items-center p-3 bg-blue-50 rounded-lg min-w-[64px]">
              <span className="text-2xl font-bold text-blue-700">{timeRemaining.seconds}</span>
              <span className="text-xs text-blue-600">{t("Giây")}</span>
            </div>
          </div>
        </div>
      )}

      {/* Thông báo */}
      <div className="p-3 text-sm text-yellow-800 bg-yellow-50 rounded-lg">
        {t(
          "Nếu bạn đã rời khỏi trang cổng thanh toán hoặc chưa hoàn tất thanh toán, hãy nhấn 'Quay lại cổng thanh toán' để tiếp tục."
        )}
      </div>

      {/* Nút hành động */}
      <div className="flex flex-col gap-2 mt-auto">
        <Button
          primary
          className="py-3 w-full font-semibold rounded-xl"
          text={t("Quay lại cổng thanh toán để thanh toán")}
          onClick={handleRetry}
          disabled={timeRemaining.expired}
        />
        {timeRemaining.expired && (
          <Button
            primary
            className="py-3 w-full rounded-xl"
            text={t("Tạo đơn mới")}
            onClick={() => router.replace(`/checkout${checkoutTypeQueryParam(order?.type)}`)}
          />
        )}
        {!timeRemaining.expired && (
          <Button
            className="py-3 w-full text-red-600 rounded-xl border border-red-300 hover:bg-red-50"
            text={t("Hủy đơn")}
            onClick={handleCancel}
          />
        )}
      </div>
    </div>
  );
}

/**
 * View hiển thị sau khi redirect về từ SePay PG
 * Xử lý 3 trạng thái: success, error, cancel
 *
 * Luôn xác minh trạng thái đơn hàng từ server trước khi hiển thị kết quả.
 * Poll liên tục mỗi 2 giây cho đến khi server trả về trạng thái cuối cùng.
 * Không bao giờ fallback sang URL param — chỉ dừng khi có status thực từ DB.
 */
function SePayPGCallbackView({
  paymentStatus,
  orderNumber,
}: {
  paymentStatus: string;
  orderNumber: string;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const [verifying, setVerifying] = useState(true);
  const [finalStatus, setFinalStatus] = useState<"success" | "error" | "cancel">("success");
  const [orderType, setOrderType] = useState<SubscriptionOrderType>("TOOL");

  useEffect(() => {
    let cancelled = false;

    const resolveFromOrder = (order: {
      paymentStatus?: string;
    }): "success" | "error" | "cancel" | null => {
      if (order.paymentStatus === PaymentStatus.PAYMENT_SUCCESS) return "success";
      if (order.paymentStatus === PaymentStatus.PAYMENT_CANCELLED) return "cancel";
      if (
        order.paymentStatus === PaymentStatus.PAYMENT_FAILED ||
        order.paymentStatus === PaymentStatus.PAYMENT_TIMEOUT
      )
        return "error";
      // PAYMENT_PENDING / PAYMENT_INITIATED / PAYMENT_UNPAID → IPN chưa về, tiếp tục polling
      return null;
    };

    const poll = setInterval(async () => {
      if (cancelled) return;
      try {
        const order = await orderService.getOrderByNumber(orderNumber);
        const resolved = order ? resolveFromOrder(order) : null;
        if (resolved) {
          clearInterval(poll);
          if (!cancelled) {
            setOrderType((order.type as SubscriptionOrderType) || "TOOL");
            setFinalStatus(resolved);
            setVerifying(false);
          }
        }
      } catch {
        // bỏ qua lỗi mạng, tiếp tục polling
      }
    }, 2000);

    return () => {
      cancelled = true;
      clearInterval(poll);
    };
  }, [paymentStatus, orderNumber]);

  if (verifying) {
    return (
      <div className="flex flex-col justify-center items-center py-20 bg-gray-100 min-h-[60vh]">
        <Spinner />
        <p className="mt-5 text-base font-semibold text-gray-700">
          {t("Đang xác nhận đơn hàng...")}
        </p>
        <p className="mt-2 text-sm text-gray-400">{t("Vui lòng không đóng trang này")}</p>
      </div>
    );
  }

  const successMessage =
    orderType === "NORMAL"
      ? t("Nạp mPoint thành công! Số dư ví của bạn đã được cập nhật.")
      : orderType === "API_MEDIA"
      ? t(
          "Gói API Media đã được kích hoạt. Vào trang API Media để xem token và bắt đầu tích hợp."
        )
      : orderType === "RECAPTCHA"
      ? t("Gói reCAPTCHA đã được kích hoạt. Vào trang reCAPTCHA để lấy API key.")
      : t("Đơn hàng của bạn đã được thanh toán thành công. Hệ thống đang xử lý đơn hàng.");

  const successButtonText =
    orderType === "NORMAL"
      ? t("Về trang chủ")
      : orderType === "API_MEDIA"
      ? t("Đến trang API Media")
      : orderType === "RECAPTCHA"
      ? t("Đến trang reCAPTCHA")
      : t("Xem đơn hàng");

  // Cấu hình hiển thị theo từng trạng thái
  const statusConfig = {
    success: {
      icon: <HiOutlineCheckCircle className="text-6xl text-green-500" />,
      lottie: "/assets/lottie/payment-success.json",
      title: t("Thanh toán thành công!"),
      message: successMessage,
      buttonText: successButtonText,
      buttonAction: () => router.push(getPostPaymentSuccessPath(orderType)),
      bgColor: "bg-green-50",
      borderColor: "border-green-200",
    },
    error: {
      icon: <HiOutlineXCircle className="text-6xl text-red-500" />,
      lottie: "/assets/lottie/cancel-transaction.json",
      title: t("Thanh toán thất bại"),
      message: t(
        "Thanh toán không thành công. Vui lòng thử lại hoặc chọn phương thức thanh toán khác."
      ),
      buttonText: t("Thử lại"),
      buttonAction: () => router.replace(`/checkout${checkoutTypeQueryParam(orderType)}`),
      bgColor: "bg-red-50",
      borderColor: "border-red-200",
    },
    cancel: {
      icon: <HiOutlineInformationCircle className="text-6xl text-yellow-500" />,
      lottie: null,
      title: t("Đã hủy đơn hàng"),
      message: t("Bạn đã hủy thanh toán. Đơn hàng đã được hủy, bạn có thể tạo đơn hàng mới."),
      buttonText: t("Tạo đơn mới"),
      buttonAction: () => router.replace(`/checkout${checkoutTypeQueryParam(orderType)}`),
      bgColor: "bg-yellow-50",
      borderColor: "border-yellow-200",
    },
  };

  const cfg = statusConfig[finalStatus];

  return (
    <div className="flex flex-col justify-center items-center min-h-[60vh] bg-gray-100 my-10 px-2">
      <div
        className={`flex flex-col items-center gap-4 p-6 w-full max-w-md ${cfg.bgColor} rounded-2xl border ${cfg.borderColor} shadow-sm`}
      >
        {/* Animation Lottie hoặc icon */}
        {cfg.lottie ? (
          <Player
            autoplay
            loop={false}
            keepLastFrame
            src={cfg.lottie}
            style={{ height: "150px", width: "150px" }}
          />
        ) : (
          cfg.icon
        )}

        <h2 className="text-xl font-bold text-gray-800">{cfg.title}</h2>
        <p className="text-sm text-center text-gray-600">{cfg.message}</p>

        {/* Hiển thị mã đơn hàng */}
        {orderNumber && (
          <div className="px-4 py-2 bg-white rounded-lg border border-gray-200">
            <span className="text-xs text-gray-500">{t("Mã đơn hàng")}: </span>
            <span className="text-sm font-semibold text-gray-800">{orderNumber}</span>
          </div>
        )}

        {/* Nút hành động chính */}
        <Button
          primary
          text={cfg.buttonText}
          onClick={cfg.buttonAction}
          className="w-full rounded-xl"
        />

        {/* Nút phụ - về trang chủ */}
        <Button
          text={t("Về trang chủ")}
          onClick={() => router.push("/")}
          className="w-full rounded-xl border border-gray-300"
        />
      </div>
    </div>
  );
}

/**
 * Màn hình thanh toán bằng chuyển khoản ngân hàng (QR + timer + thông tin bank)
 */
function CheckoutPaymentPay() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();
  const router = useRouter();
  const { order } = useCheckoutContext();
  const [openVideo, setOpenVideo] = useState<string>(null);
  const checkingPaymentRef = useRef(null);
  const { customer } = useAuth();

  // Đồng hồ đếm ngược 30 phút
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 30, seconds: 0, expired: false });

  // Đếm ngược thời gian thanh toán
  useEffect(() => {
    if (!order) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const createdTime = new Date(order.updatedAt).getTime();
      const expiry = createdTime + 30 * 60 * 1000;
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
        clearInterval(checkingPaymentRef.current);
        clearInterval(interval);
        cancelOrder().then(() => {});
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds, expired: false });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  // Polling kiểm tra trạng thái thanh toán mỗi 3 giây
  useEffect(() => {
    checkingPaymentRef.current = setInterval(async () => {
      await checkPayment();
    }, 3000);
    return () => {
      clearInterval(checkingPaymentRef.current);
    };
  }, [customer]);

  /**
   * Kiểm tra trạng thái thanh toán của đơn hàng
   * Nếu đã thanh toán thành công → điều hướng sang trang đơn hàng
   */
  const checkPayment = async () => {
    if (!order?.orderNumber) return;
    try {
      const latestOrder = await orderService.getOrderByNumber(order.orderNumber);
      if (latestOrder?.paymentStatus === PaymentStatus.PAYMENT_SUCCESS) {
        clearInterval(checkingPaymentRef.current);
        // Điều hướng về trang callback success để hiển thị thông báo
        router.replace(`/checkout?payment=success&orderNumber=${order.orderNumber}`);
      }
    } catch {
      // Bỏ qua lỗi khi kiểm tra
    }
  };

  const cancelOrder = async () => {
    await orderService.cancelOrder(order.id);
  };

  const onCancelOrder = async () => {
    alert.warn(
      t("XÁC NHẬN HỦY ĐƠN?"),
      t("Bạn có chắc chắn muốn hủy đơn này không?"),
      t("Có"),
      async () => {
        await cancelOrder()
          .then(async () => {
            await clearInterval(checkingPaymentRef.current);
            toast.success(t("Hủy đơn thành công"));
            router.replace("/");
          })
          .catch((err) => {
            toast.error(`${t("Hủy đơn thất bại")}, ${err}`);
          });
        return true;
      }
    );
  };

  return (
    <div className="flex-1 p-4 bg-white rounded-md">
      <div className="flex flex-col gap-1">
        <div className="p-2 w-full rounded-md border">
          <ImageQRBank />
        </div>
      </div>

      {/* Cảnh báo chuyển khoản đúng nội dung */}
      <div className={`flex flex-row items-start p-2 mt-2 w-full bg-yellow-100 rounded-lg`}>
        <i className="mr-1 text-yellow-800 text-20">
          <HiOutlineInformationCircle />
        </i>
        <span className="text-yellow-800 lg:text-16 text-14">
          {t("Vui lòng chuyển khoản theo đúng [Nội dung chuyển khoản] mà chúng tôi đã cung cấp!")}
        </span>
      </div>

      {/* Đồng hồ đếm ngược */}
      <div className="flex flex-col justify-center items-center py-4">
        <span className="pb-2 text-center text-gray-500 lg:text-16 text-14">
          {t("Thời gian còn lại để xác nhận thanh toán")}
        </span>
        <div className="flex flex-row gap-4">
          <div className="flex flex-col justify-center items-center p-3 bg-green-100 rounded-md">
            <div className="font-bold text-green-800 text-24">{timeRemaining.minutes}</div>
            <div className="text-green-800">{t("Phút")}</div>
          </div>
          <div className="flex flex-col justify-center items-center p-3 bg-green-100 rounded-md">
            <div className="font-bold text-green-800 text-24">{timeRemaining.seconds}</div>
            <div className="text-green-800">{t("Giây")}</div>
          </div>
        </div>
      </div>

      {/* Thông báo hệ thống tự xác nhận */}
      <div className={`flex flex-row items-start p-2 mt-4 w-full bg-blue-100 rounded-lg`}>
        <i className="mr-1 text-blue-800 text-20">
          <HiOutlineInformationCircle />
        </i>
        <span className="text-blue-800 lg:text-16 text-14">
          {t(
            "Hệ thống sẽ tự động xác nhận thanh toán. Vui lòng đợi trong giây lát sau khi đã chuyển khoản."
          )}
        </span>
      </div>

      {/* Các nút hành động */}
      <div className="flex flex-col gap-2 mt-4">
        <Button
          outline
          text={t("Đã thanh toán - Kiểm tra ngay")}
          className="w-full"
          onClick={async () => {
            await checkPayment();
          }}
        />
        <Button
          outline
          className="w-full text-red-600 border-red-600 hover:bg-red-50"
          text={t("Hủy đơn hàng")}
          onClick={onCancelOrder}
        />
      </div>

      {/* Link hỗ trợ */}
      <div className="flex justify-center pt-4 lg:text-16 text-14">
        <span>
          {t("Gặp khó khăn khi thanh toán?.")}
          <span
            className="mx-1 text-green-800 underline cursor-pointer lg:text-16 text-14"
            onClick={() => setOpenVideo("https://youtu.be/R17IHE0eRUM")}
          >
            {t("Xem hướng dẫn")}
          </span>
          {t(" hoặc ")}
          <a href="https://www.facebook.com/messages/t/102911701762800/" target={"_blank"}>
            <span className="mx-1 text-red-800 underline lg:text-16 text-14">
              {t("liên hệ chúng tôi!")}
            </span>
          </a>
        </span>
      </div>
      <VideoDialog
        videoUrl={openVideo}
        isOpen={openVideo ? true : false}
        onClose={() => setOpenVideo(null)}
      />
    </div>
  );
}

/**
 * Component hiển thị mã QR VietQR để chuyển khoản ngân hàng
 */
export function ImageQRBank() {
  const { t } = useTranslation();
  const { order } = useCheckoutContext();

  const [hasImage, setHasImage] = useState(true);

  const handleImageError = () => setHasImage(false);
  const handleImageSuccess = () => setHasImage(true);

  const QRImage = () =>
    hasImage ? (
      <img
        className="mx-auto"
        width={300}
        src={`https://api.vietqr.io/image/${order?.paymentInfo?.bin}-${order?.paymentInfo?.accountNumber}-8bNuIQ0.jpg?accountName=${order?.paymentInfo?.accountName}&amount=${order?.totalAmount}&addInfo=${order?.orderNumber}
      `}
        onError={handleImageError}
        onLoad={handleImageSuccess}
      />
    ) : (
      <>
        <p style={{ paddingTop: "270px" }} className="font-semibold">
          <Spinner className="absolute top-1/2 left-1/2 z-10 transform -translate-x-1/2 -translate-y-1/2" />
          {`${t("Vui lòng tải lại trang để thấy mã QR")}...`}
        </p>
      </>
    );

  return (
    <div className="text-center">
      <p className="font-semibold text-14 md:text-16">{t("QUÉT QRCODE")}</p>
      <p className="font-semibold text-gray-500 text-14 md:text-16">
        {t("Quét mã qua ứng dụng Ngân hàng/ Ví điện tử của bạn để chuyển khoản nhanh chóng")}
      </p>
      <div style={{ width: "300px", height: "300px" }} className="relative z-0 mx-auto">
        <QRImage />
        <Player
          className="absolute top-8 left-1/2 z-10 transform -translate-x-1/2"
          autoplay
          loop
          src={`/assets/lottie/qr.json`}
          style={{ height: "240px", width: "240px" }}
        ></Player>
      </div>
    </div>
  );
}

/**
 * Component hiển thị thông tin chuyển khoản ngân hàng chi tiết
 * (tên ngân hàng, số tài khoản, nội dung chuyển khoản v.v.)
 */
export function PaymentMethodInfo() {
  const { t } = useTranslation();
  const { order } = useCheckoutContext();
  const toast = useToast();

  function copyToClipboard(text: string) {
    copy(text);
    toast.success(t("Đã sao chép"));
  }

  if (!order) return <Spinner />;

  return (
    <div
      className="mt-2 bg-white rounded-xl border border-gray-200"
      style={{
        backgroundImage: `url(https://i.imgur.com/sggzEJd.jpg)`,
        backgroundRepeat: "no-repeat",
        backgroundPositionX: "center",
        backgroundPositionY: "-50px",
      }}
    >
      <div className="p-4">
        <div className="flex flex-row justify-between items-center pb-5">
          <span className="whitespace-nowrap">{t("Phương thức thanh toán")}</span>
          <span className="font-bold uppercase text-primary">
            {PaymentMethod[order?.paymentInfo?.method]}
          </span>
        </div>
        <div>
          <>
            <div className="flex flex-row items-center pb-5 text-14 lg:text-16">
              <span className="mr-2 whitespace-nowrap">{t("Tên ngân hàng")}</span>
              <span className="font-bold uppercase text-primary">
                {order?.paymentInfo.bankName}
              </span>
            </div>
            <div className="flex flex-row items-center pb-5 lg:text-16 text-14">
              <span className="mr-2 whitespace-nowrap">{t("Chủ tài khoản")}</span>
              <span className="font-bold uppercase text-primary">
                {order?.paymentInfo.accountName}
              </span>
            </div>
            <div className="flex flex-row justify-between items-center pb-5 text-14 lg:text-16">
              <div>
                <span className="mr-2 whitespace-nowrap">{t("Số tài khoản")}</span>
                <span className="font-bold text-primary">{order?.paymentInfo.accountNumber}</span>
              </div>
              <i
                data-tooltip={t("Sao chép")}
                className="pl-20 text-gray-500 cursor-pointer text-24 hover:text-primary"
                onClick={() => copyToClipboard(order?.paymentInfo.accountNumber)}
              >
                <RiFileCopy2Line />
              </i>
            </div>
            <div className="flex flex-row justify-between items-center pb-5 text-14 lg:text-16">
              <div>
                <span className="mr-2 whitespace-nowrap">{`${t("Tổng tiền chuyển")}: `} </span>
                <span className="font-bold text-primary">
                  {parseNumber(order?.totalAmount) + "đ"}
                </span>
              </div>
              <i
                data-tooltip={t("Sao chép")}
                className="pl-12 text-gray-500 cursor-pointer text-24 hover:text-primary"
                onClick={() => copyToClipboard(String(order?.totalAmount))}
              >
                <RiFileCopy2Line />
              </i>
            </div>
            <div className="flex flex-row justify-between items-center pb-5 text-14 lg:text-16">
              <div>
                <span className="mr-2 whitespace-nowrap">{t("Nội dung chuyển khoản")}</span>
                <span className="font-bold uppercase text-primary">{order?.orderNumber}</span>
              </div>
              <i
                data-tooltip={t("Sao chép")}
                className="text-gray-500 cursor-pointer text-24 hover:text-primary"
                onClick={() => copyToClipboard(order?.orderNumber)}
              >
                <RiFileCopy2Line />
              </i>
            </div>
          </>
        </div>
      </div>
    </div>
  );
}
