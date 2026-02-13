import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ThreadPage } from "../../../../components/admin/management/thread/thread-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Cuộc trò chuyện")} />
      <ThreadPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
