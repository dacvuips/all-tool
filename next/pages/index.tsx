import { useRouter } from "next/router";
import { useEffect } from "react";
import { HomePage } from "../components/index/home/home-page";

import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import { Spinner } from "../components/shared/utilities/misc";
import { HomeLayout } from "../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../lib/functions/locale";

export default function Page(props) {
  const { t } = useTranslation();
  const router = useRouter();
  const { code, ...rest } = router.query;

  useEffect(() => {
    if (code) {
      router.replace({ pathname: `/${code}`, query: { ...rest } });
    }
  }, [code]);

  if (code) return <Spinner />;
  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://midman.vn",
          title: t("Giải pháp giao dịch MMO an toàn"),
          description: t("Giải pháp giao dịch MMO an toàn - Giao dịch MMO - Trực tuyến"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Giải pháp giao dịch an toàn - Giao dịch MMO - Trực tuyến")}
        title={t("Giải pháp giao dịch MMO an toàn")}
      />
      <HomePage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
