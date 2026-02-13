import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { PostsPage } from "../../../../components/admin/management/support/post/posts-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Bài viết")} />
      <PostsPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
