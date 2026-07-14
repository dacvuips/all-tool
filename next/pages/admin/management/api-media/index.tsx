import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ApiMediaAdminPage } from "../../../../components/admin/management/api-media/api-media-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Quản lý API Media")} />
      <ApiMediaAdminPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
