import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { CategoryPage } from "../../../../components/admin/management/category/category-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo title={t("Danh mục")} />
      <CategoryPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
