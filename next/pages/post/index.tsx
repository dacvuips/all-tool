import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { PostPage } from "../../components/index/post-desktop/post-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Danh sách bài viết")} />
      <PostPage />
    </>
  );
}

Page.Layout = HomeLayout;
Page.LayoutProps = { name: "Danh sách bài viết" };
export const getServerSideProps = getServerSideTranslationsProps();
