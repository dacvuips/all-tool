import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { AllNotificationPage } from "../../../../components/admin/management/all-notification/all-notification-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Thông báo")} />
      <AllNotificationPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
