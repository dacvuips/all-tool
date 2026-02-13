import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { AdminTrainingPage } from "../../../../components/admin/management/training/training-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Hướng dẫn")} />
      <AdminTrainingPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
