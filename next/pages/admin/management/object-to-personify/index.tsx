import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ObjectToPersonifyPage } from "../../../../components/admin/management/object-to-personify/object-to-personify-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Quản lý nhân vật")} />
      <ObjectToPersonifyPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
