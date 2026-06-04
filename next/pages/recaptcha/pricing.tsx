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
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Gói reCAPTCHA"),
          description: t("Chọn gói reCAPTCHA phù hợp để bảo vệ ứng dụng của bạn"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Chọn gói reCAPTCHA phù hợp để bảo vệ ứng dụng của bạn")}
        title={t("Viet Theo Veo - Gói reCAPTCHA")}
      />
      <RecaptchaTabLayout defaultTab={1} />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
