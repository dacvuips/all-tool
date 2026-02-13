import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { CredentialPage } from "../../../../components/admin/management/credential/credential-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Quản lý chứng chỉ")} />
      <CredentialPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
