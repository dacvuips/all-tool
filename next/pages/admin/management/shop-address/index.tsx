import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ShopAddressPage } from "../../../../components/admin/management/shop-address/shop-address-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Địa chỉ cửa hàng")} />
      <ShopAddressPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
