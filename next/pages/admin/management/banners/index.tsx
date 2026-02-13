import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { BannersPage } from "../../../../components/admin/management/banners/banners-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Banner")} />
      <BannersPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
