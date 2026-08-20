import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import FilmTabLayout from "../../components/film/film-tab-layout";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Film"),
          description: t("Viet Theo Veo - Film"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Viet Theo Veo - Film")}
        title={t("Viet Theo Veo - Film")}
      />
      <FilmTabLayout />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
