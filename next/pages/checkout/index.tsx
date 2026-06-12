import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";

import { CheckoutPage } from "../../components/index/checkout/checkout-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site/checkout",
          title: t("Thanh toán đơn hàng"),
          description: t(
            "Thanh toán đơn hàng trực tuyến 24/7 - Hệ thống tự động xác nhận thanh toán qua cổng thanh toán"
          ),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t(
          "Thanh toán đơn hàng - Hệ thống tự động xác nhận thanh toán qua cổng thanh toán"
        )}
        title={t("Thanh toán đơn hàng 24/7")}
      />

      <CheckoutPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
