import Head from "next/head";
import { useTranslation } from "react-i18next";
import { BreadCrumbs, Spinner } from "../../shared/utilities/misc";
import { ProductImgSlider } from "./components/product-img-slider";
import { ProductInfo } from "./components/product-info";
import { useProductDetailContext } from "./provider/product-detail-provider";

export const ProductDetailPage = () => {
  const { t } = useTranslation();
  const { product } = useProductDetailContext();

  if (!product) return <Spinner />;

  const productName = product?.name || t("Sản phẩm");
  const productDescription = product?.des || "";
  const productImage = product?.coverImg || "";

  return (
    <>
      <Head>
        <title>
          {productName} | {t("Trang chủ")}
        </title>
        <meta name="description" content={productDescription.slice(0, 160)} />
        <meta property="og:title" content={productName} />
        <meta property="og:description" content={productDescription.slice(0, 160)} />
        <meta property="og:image" content={productImage} />
        <meta property="og:type" content="product" />
        <meta name="twitter:card" content="summary_large_image" />
      </Head>
      <section className="flex flex-col flex-1 w-full mx-auto max-w-7xl">
        {/* Breadcrumbs */}
        <div className="mb-4 lg:mb-6">
          <BreadCrumbs
            className="relative z-10"
            breadcrumbs={[
              {
                href: "/",
                label: t("Trang chủ"),
              },
              {
                href: `/${product?.slug}`,
                label: productName,
              },
            ]}
          />
        </div>

        {/* Main Product Content */}
        <div className="overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm">
          <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2 lg:gap-8 lg:p-6">
            {/* Product Images */}
            <div className="w-full">
              <ProductImgSlider />
            </div>

            {/* Product Info */}
            <div className="w-full">
              <ProductInfo />
            </div>
          </div>
        </div>

        {/* Additional sections can be added here */}
        {/* <ProductShopInfo productDetail={productDetail} shopCode={shopCode} />
          <ProductViewGroup />
          <ProductShop />
          <HomeStreams />
          <ProductDetailSimilar /> */}
      </section>
    </>
  );
};
