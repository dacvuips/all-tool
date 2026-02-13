import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ReportPage } from "../../../../components/admin/management/report/report-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Báo cáo")} />
      <ReportPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
