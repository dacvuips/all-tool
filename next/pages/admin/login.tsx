import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { LoginPage } from "../../components/admin/login/login-page";
import { NoneLayout } from "../../layouts/none-layout/none-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Đăng nhập Admin")} />
      <LoginPage />
    </>
  );
}

Page.Layout = NoneLayout;
export const getServerSideProps = getServerSideTranslationsProps();
