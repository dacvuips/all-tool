import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../lib/providers/auth-provider";
import { CheckoutProvider, useCheckoutContext } from "./provider/checkout-provider";

import { Player } from "@lottiefiles/react-lottie-player";
import copy from "copy-to-clipboard";
import router, { useRouter } from "next/router";
import { HiOutlineInformationCircle } from "react-icons/hi";
import { RiFileCopy2Line } from "react-icons/ri";
import { parseNumber } from "../../../lib/helpers/parser";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { orderService, PaymentMethod, PaymentStatus } from "../../../lib/repo/order/order.repo";
import { VideoDialog } from "../../shared/common/video-dialog";
import { Button } from "../../shared/utilities/form";
import { Spinner } from "../../shared/utilities/misc";
import { CheckoutPayment } from "./components/checkout-payment";
import { CheckoutPaymentForm } from "./components/checkout-payment-form";

export function CheckoutPage() {
  return (
    <>
      <CheckoutProvider>
        <CheckoutComponent />
      </CheckoutProvider>
    </>
  );
}

function CheckoutComponent() {
  const { order } = useCheckoutContext();
  const { customer } = useAuth();
  const toast = useToast();
  const { t } = useTranslation();
  useEffect(() => {
    if (customer === null) {
      toast.error(t("Vui lòng đăng nhập để tiếp tục"));
      router.replace("/");
    }
  }, [customer]);

  if (!customer) return <Spinner />;
  if (!order || order.paymentStatus == PaymentStatus.PAYMENT_INITIATED)
    return <CheckoutPaymentForm />;

  return (
    <>
      <div className="flex flex-col pb-10 bg-gray-100">
        <div className="container px-2 mx-auto sm:px-4">
          <div className="flex flex-col-reverse gap-3 lg:grid lg:grid-cols-12">
            <div className="col-span-full md:col-span-5 lg:col-span-4">
              <CheckoutPayment />
            </div>
            <div className="col-span-full md:col-span-7 lg:col-span-8">
              <CheckoutPaymentPay />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function CheckoutPaymentPay() {
  const { t } = useTranslation();
  const toast = useToast();
  const alert = useAlert();
  const router = useRouter();
  const { order } = useCheckoutContext();
  const [openVideo, setOpenVideo] = useState<string>(null);
  const checkingPaymentRef = useRef(null);
  const { customer } = useAuth();

  // Calculate time remaining based on order expiration
  const [timeRemaining, setTimeRemaining] = useState({ minutes: 30, seconds: 0, expired: false });

  useEffect(() => {
    if (!order) return;

    const interval = setInterval(() => {
      const now = new Date().getTime();
      const createdTime = new Date(order.updatedAt).getTime();
      const expiry = createdTime + 30 * 60 * 1000; // Thêm 30 phút từ lúc tạo đơn
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining({ minutes: 0, seconds: 0, expired: true });
        // setCancelOrder(true);
        clearInterval(checkingPaymentRef.current);
        clearInterval(interval);
      } else {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        setTimeRemaining({ minutes, seconds, expired: false });
      }
      // nếu quá thời gian thì dừng và chạy hàm cancel order
      if (diff <= 0) {
        cancelOrder().then(() => {
          // router.replace("/");
        });
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [order]);

  useEffect(() => {
    checkingPaymentRef.current = setInterval(async () => {
      await CheckPayment();
    }, 3000);
    return () => {
      clearInterval(checkingPaymentRef.current);
    };
  }, [customer]);

  const CheckPayment = async () => {
    // await OrderService?.getOne({ id: order?.id, cache: false }).then((res: any) => {
    //   if (
    //     res.status === CheckoutOrderStatus.PROCESSING ||
    //     res.status === CheckoutOrderStatus.COMPLETED
    //   ) {
    //     setProcessOrder(true);
    //     clearInterval(checkingPaymentRef.current);
    //   }
    // });
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
            // await setCancelOrder(true);
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
        {/* <div className="flex-1 p-2 rounded-md border">
          <p className="font-semibold text-14 md:text-16">
            {`${t("Cách 2")}: ${t("CHUYỂN KHOẢN THEO THÔNG TIN")}`}
          </p>
          <PaymentMethodInfo />
        </div> */}
      </div>
      <div className={`flex flex-row items-start p-2 mt-2 w-full bg-yellow-100 rounded-lg`}>
        <i className="mr-1 text-yellow-800 text-20">
          <HiOutlineInformationCircle />
        </i>
        <span className="text-yellow-800 lg:text-16 text-14">
          {t("Vui lòng chuyển khoản theo đúng [Nội dung chuyển khoản] mà chúng tôi đã cung cấp!")}
        </span>
      </div>

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

      <div className="flex flex-col gap-2 mt-4">
        <Button
          outline
          text={t("Đã thanh toán - Kiểm tra ngay")}
          className="w-full"
          onClick={async () => {
            await CheckPayment();
          }}
        />
        <Button
          outline
          className="w-full text-red-600 border-red-600 hover:bg-red-50"
          text={t("Hủy đơn hàng")}
          onClick={onCancelOrder}
        />
      </div>

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

export function ImageQRBank() {
  const { t } = useTranslation();
  const { order } = useCheckoutContext();

  const [hasImage, setHasImage] = useState(true);
  const handleImageError = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Code to handle the error here
    setHasImage(false);
  };
  const handleImageSuccess = (event: React.SyntheticEvent<HTMLImageElement, Event>) => {
    // Code to handle the error here
    setHasImage(true);
  };

  const ImageQRBank = () =>
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
        <ImageQRBank />

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

function PaymentMethodInfo() {
  const { t } = useTranslation();
  const { order } = useCheckoutContext();
  const toast = useToast();
  function copyToClipboard(text) {
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
                onClick={() => {
                  copyToClipboard(order?.paymentInfo.accountNumber);
                }}
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
                onClick={() => {
                  copyToClipboard(order?.amount);
                }}
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
                onClick={() => {
                  copyToClipboard(order?.code);
                }}
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
