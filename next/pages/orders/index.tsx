import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";

import { OrdersGuestPage } from "../../components/index/order/order-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://midman.vn/checkout",
          title: t("Thanh toán đơn hàng - Midman"),
          description: t(
            "Thanh toán đơn hàng trực tuyến 24/7 - Hệ thống tự động xác nhận thanh toán qua Casso"
          ),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Thanh toán đơn hàng - Hệ thống tự động xác nhận thanh toán qua Casso")}
        title={t("Thanh toán đơn hàng 24/7 - Midman")}
      />

      <OrdersGuestPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
