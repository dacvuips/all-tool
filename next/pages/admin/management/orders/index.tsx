import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { OrderPage } from "../../../../components/admin/management/order/order-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Quản lý đơn hàng")} />
      <OrderPage />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
