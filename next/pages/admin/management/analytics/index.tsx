import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { AnalyticPage } from "../../../../components/admin/management/analytic/analytic-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();

  return (
    <>
      {" "}
      <NextSeo title={t("Phân tích")} />
      <AnalyticPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
