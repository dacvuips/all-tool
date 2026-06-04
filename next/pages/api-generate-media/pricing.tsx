import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import ApiMediaTabLayout from "../../components/api-media/api-media-tab-layout";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Gói API Media"),
          description: t("Chọn gói API Media phù hợp để bảo vệ ứng dụng của bạn"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Chọn gói API Media phù hợp để bảo vệ ứng dụng của bạn")}
        title={t("Viet Theo Veo - Gói API Media")}
      />
      <ApiMediaTabLayout defaultTab={1} />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
