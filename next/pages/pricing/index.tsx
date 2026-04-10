import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import PricingPage from "../../components/pricing/pricing-page";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://aitipmart.site/pricing",
          title: t("Bảng Giá Dịch Vụ"),
          description: t(
            "Chọn gói phù hợp với bạn - Trải nghiệm toàn bộ sức mạnh AI trong sáng tạo video"
          ),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t(
          "Chọn gói phù hợp với bạn - Trải nghiệm toàn bộ sức mạnh AI trong sáng tạo video"
        )}
        title={t("Bảng Giá Dịch Vụ")}
      />
      <PricingPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
