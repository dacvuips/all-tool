import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ProfilePage } from "../../components/index/profile/profile-page";
import { ProfilePageWebapp } from "../../components/index/profile/profile-page-webapp";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { t } from "../../lib/functions/i18n";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";
import { useScreen } from "../../lib/hooks/useScreen";

export default function Page(props) {
  const { t } = useTranslation();
  const screenLg = useScreen("lg");

  return (
    <>
      <NextSeo title={t("Thông tin tài khoản")} />
      {screenLg ? <ProfilePage /> : <ProfilePageWebapp />}
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Tài khoản") };
export const getServerSideProps = getServerSideTranslationsProps();
