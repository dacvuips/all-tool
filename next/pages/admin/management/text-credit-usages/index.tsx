import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { TextCreditUsagePage } from "../../../../components/admin/management/text-credit-usage/text-credit-usage-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Điểm Voice")} />
      <TextCreditUsagePage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
