import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { HomePage } from "../components/index/home/home-page";
import { HomeLayout } from "../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Công Cụ AI Miễn Phí"),
          description: t("Viet Theo Veo - Công Cụ AI Miễn Phí"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Viet Theo Veo - Công Cụ AI Miễn Phí")}
        title={t("Viet Theo Veo - Công Cụ AI Miễn Phí")}
      />
      <HomePage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
