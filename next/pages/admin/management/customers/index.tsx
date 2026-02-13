import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { CustomerPage } from "../../../../components/admin/management/customer/customer-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Khách hàng")} />
      <CustomerPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
