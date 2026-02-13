import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { UserPage } from "../../../../components/admin/management/users/user-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Quản lý tài khoản")} />
      <UserPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
