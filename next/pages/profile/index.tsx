import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ProfilePage } from "../../components/index/profile/profile-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { t } from "../../lib/functions/i18n";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo title={t("Thông tin tài khoản")} />
      <ProfilePage />
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Tài khoản") };
export const getServerSideProps = getServerSideTranslationsProps();
