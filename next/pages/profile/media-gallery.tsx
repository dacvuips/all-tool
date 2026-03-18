import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ProfileMediaGallery } from "../../components/index/profile/components/media-gallery/profile-media-gallery";
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
      <NextSeo title={t("Thư viện Media")} />
      {screenLg ? <ProfilePage /> : <ProfileMediaGallery />}
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: t("Thư viện Media") };
export const getServerSideProps = getServerSideTranslationsProps();
