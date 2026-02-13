import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { AuthorityPage } from "../../../../components/admin/management/authority/authority-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Phân quyền")} />
      <AuthorityPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
