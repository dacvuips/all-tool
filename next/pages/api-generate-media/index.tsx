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
          title: t("Viet Theo Veo - API Video"),
          description: t("Viet Theo Veo - API Video"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Viet Theo Veo - API Video")}
        title={t("Viet Theo Veo - API Video")}
      />
      <ApiMediaTabLayout defaultTab={0} />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
