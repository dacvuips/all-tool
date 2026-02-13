import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import CartPage from "../../components/index/cart/cart-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Giỏ hàng")} />

      <CartPage />
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: "Giỏ hàng" };
export const getServerSideProps = getServerSideTranslationsProps();
