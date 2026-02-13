import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ProfileUserPage } from "../../../../components/admin/management/profile-user/profile-user-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Hồ sơ tài khoản")} />
      <ProfileUserPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
