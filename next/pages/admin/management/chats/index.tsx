import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { ChatPages } from "../../../../components/admin/management/chat/chat-page";
import { AdminLayout } from "../../../../layouts/admin-layout/admin-layout";
import { getServerSideTranslationsProps } from "../../../../lib/functions/locale";

export default function Page() {
  const { t } = useTranslation();
  return (
    <>
      <NextSeo title={t("Cuộc trò chuyện")} />
      <ChatPages />
    </>
  );
}
Page.Layout = AdminLayout;
export const getServerSideProps = getServerSideTranslationsProps();
