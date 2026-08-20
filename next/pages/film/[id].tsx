import { NextSeo } from "next-seo";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import FilmWorkspace from "../../components/film/film-workspace";
import { HomeLayout } from "../../layouts/home-layout/home-layout";
import { getServerSideTranslationsProps } from "../../lib/functions/locale";

export default function FilmProjectPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const rawId = router.query.id;
  const id =
    typeof rawId === "string"
      ? decodeURIComponent(rawId)
      : Array.isArray(rawId) && typeof rawId[0] === "string"
        ? decodeURIComponent(rawId[0])
        : "";

  const ready = router.isReady;

  return (
    <>
      <NextSeo
        openGraph={{
          url: "https://viettheo.site",
          title: t("Viet Theo Veo - Film"),
          description: t("Viet Theo Veo - Film"),
          images: [{ url: "/assets/img/logo-icon.png" }],
        }}
        description={t("Viet Theo Veo - Film")}
        title={t("Viet Theo Veo - Film")}
      />
      {!ready || !id ? (
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-400">
          {t("Đang tải...")}
        </div>
      ) : (
        <FilmWorkspace projectId={id} />
      )}
    </>
  );
}

FilmProjectPage.Layout = HomeLayout;

export const getServerSideProps = getServerSideTranslationsProps();
