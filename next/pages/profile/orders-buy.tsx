import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ProfileOrderBuyPage } from "../../components/index/profile/components/order-buy/order-buy-page";
import { ProfilePage } from "../../components/index/profile/profile-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { t } from "../../lib/functions/i18n";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";
import { useScreen } from "../../lib/hooks/useScreen";

export default function Page(props) {
  const { t } = useTranslation();
  const screenLg = useScreen("lg");
  return (
    <>
      <NextSeo title={t("Đơn trung gian mua")} />
      {screenLg ? <ProfilePage /> : <ProfileOrderBuyPage />}
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Đơn trung gian mua") };
export const getServerSideProps = getServerSideTranslationsProps();
