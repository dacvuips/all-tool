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
      <NextSeo title={t("Hồ sơ của tôi")} />
      <ProfilePage />
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Hồ sơ của tôi") };
export const getServerSideProps = getServerSideTranslationsProps();
