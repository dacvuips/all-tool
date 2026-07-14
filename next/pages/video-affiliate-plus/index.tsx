import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import VideoAffiliatePlusPage from "../../components/video-affiliate-plus/video-affiliate-plus-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Video Affiliate Plus"),
          description: t("Quản lý và tạo danh sách affiliate video"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Quản lý và tạo danh sách affiliate video")}
        title={t("Viet Theo Veo - Video Affiliate Plus")}
      />
      <VideoAffiliatePlusPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
