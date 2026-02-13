import { GetServerSidePropsContext } from "next";
import { ProductModel } from "../../dist/libs/dal/product/product.model";

import { ProductDetailPage } from "../components/index/product/product-detail-page";
import { ProductDetailProvider } from "../components/index/product/provider/product-detail-provider";
import { HomeLayout } from "../layouts/home-layout/home-layout";
import { CONSTANTS } from "../lib/constants/constants";
import { getTranslationProps } from "../lib/functions/locale";
import { useSEO } from "../lib/hooks/useSEO";
export default function Page(props) {
  return (
    <ProductDetailProvider>
      <ProductDetailPage />
    </ProductDetailProvider>
  );
}
Page.Layout = HomeLayout;
export async function getServerSideProps(context: GetServerSidePropsContext) {
  const { slug } = context.query;

  // Skip nếu là admin route hoặc các route đặc biệt
  if (CONSTANTS.excludedRoutes.includes(slug as string)) {
    return;
  }

  const product = await ProductModel.findOne({ slug }, "_id name des coverImg");

  const seo = await useSEO(product?.name, {
    image: product?.coverImg || "/assets/img/logo-vuong.png",
    description: product?.des,
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
