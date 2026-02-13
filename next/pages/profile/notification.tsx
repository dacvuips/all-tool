import { NextSeo } from "next-seo";

import { useTranslation } from "react-i18next";
import { ProfileNotificationPage } from "../../components/index/profile/components/notification/profile-notification-page";
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
      <NextSeo title={t("Thông báo")} />
      {screenLg ? <ProfilePage /> : <ProfileNotificationPage />}
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Thông báo") };
export const getServerSideProps = getServerSideTranslationsProps();
