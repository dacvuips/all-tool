import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { WalletTransactionPage } from "../../../../components/admin/management/wallet-transaction/wallet-transaction-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Ví giao dịch")} />
      <WalletTransactionPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
