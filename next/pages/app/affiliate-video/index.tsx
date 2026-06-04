import { useRouter } from "next/router";
import { useEffect } from "react";

import { NextSeo } from "next-seo";
import { useTranslation } from "react-i18next";
import AffiliateVideoPage from "../../../components/app/affiliate-video/affiliate-video-page";
import { Spinner } from "../../../components/shared/utilities/misc";
import { HomeLayout } from "../../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../../lib/functions/locale";

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
          url: "https://viettheo.site",
          title: t("Giải pháp Video AI Miễn Phí"),
          description: t("Giải pháp Video AI Miễn Phí"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Giải pháp Video AI Miễn Phí")}
        title={t("Giải pháp Video AI Miễn Phí")}
      />
      <AffiliateVideoPage />
    </>
  );
}

Page.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
