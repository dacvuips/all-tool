import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ShippingProvidersPage } from "../../../../components/admin/management/shipping-providers/shipping-providers-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

/**
 * Page danh sách nhà cung cấp vận chuyển
 * Route: /admin/management/shipping-providers
 */
export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Nhà cung cấp vận chuyển")} />
      <ShippingProvidersPage />
    </>
  );
}

Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
