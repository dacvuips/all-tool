import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import RecaptchaTabLayout from "../../components/recaptcha/recaptcha-tab-layout";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://aitipmart.site",
          title: t("AI Tip Mart - Công Cụ AI Miễn Phí"),
          description: t("AI Tip Mart - Công Cụ AI Miễn Phí"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("AI Tip Mart - Công Cụ AI Miễn Phí")}
        title={t("AI Tip Mart - Công Cụ AI Miễn Phí")}
      />
      <RecaptchaTabLayout defaultTab={0} />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
