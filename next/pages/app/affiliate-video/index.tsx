import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import AffiliateVideoPage from "../../../components/app/affiliate-video/affiliate-video-page";
import { HomeLayout } from "../../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("AI Affiliate Video Workshop")} />

      <AffiliateVideoPage />
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: "AI Affiliate Video Workshop" };
export const getServerSideProps = getServerSideTranslationsProps();
