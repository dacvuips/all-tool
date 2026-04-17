import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import RecaptchaPricingPage from "../../components/recaptcha/recaptcha-pricing-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://aitipmart.site",
          title: t("AI Tip Mart - Gói reCAPTCHA"),
          description: t("Chọn gói reCAPTCHA phù hợp để bảo vệ ứng dụng của bạn"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Chọn gói reCAPTCHA phù hợp để bảo vệ ứng dụng của bạn")}
        title={t("AI Tip Mart - Gói reCAPTCHA")}
      />
      <RecaptchaPricingPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
