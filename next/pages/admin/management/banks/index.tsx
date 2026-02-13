import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { BankPage } from "../../../../components/admin/management/bank/bank-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Ngân hàng")} />
      <BankPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
