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
          url: "https://aitipmart.site",
          title: t("AI Tip Mart - API Video"),
          description: t("AI Tip Mart - API Video"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("AI Tip Mart - API Video")}
        title={t("AI Tip Mart - API Video")}
      />
      <ApiMediaTabLayout defaultTab={0} />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
