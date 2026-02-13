import { GetServerSidePropsContext } from "next";
import { i18n } from "next-i18next";
import { PostModel } from "../../../dist/libs/dal/post/post.model";
import { PostDetail } from "../../components/index/post-desktop/components/post-detail";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getTranslationProps } from "../../lib/functions/locale";
import { useSEO } from "../../lib/hooks/useSEO";
export default function Page(props) {
  return (
    <>
      <PostDetail />
    </>
  );
}
Page.Layout = HomeLayout;
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { slug } = context.query;

  const post = await PostModel.findOne({ slug }, "_id title excerpt featureImage");

  const seo = await useSEO(post?.title, {
    image: post?.featureImage || "/assets/img/logo-vuong.png",
    description: post?.excerpt || `"StoreMMO | ${i18n?.t("bài viết")}`,
  });
  const initTranslationsProps = await getTranslationProps(context.locale, ["common"]);

  return {
    props: JSON.parse(
      JSON.stringify({
        seo,
        ...initTranslationsProps,
      })
    ),
  };
}
