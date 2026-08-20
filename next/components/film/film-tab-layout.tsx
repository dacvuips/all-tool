import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiFilm } from "react-icons/hi";
import { useScreen } from "../../lib/hooks/useScreen";
import FilmPage from "./film-page";

export default function FilmTabLayout() {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");

  return (
    <div className="bg-gray-100 min-h-screen w-full">
      <div className="sticky top-14 z-40 bg-white shadow-sm w-full">
        <div className="flex items-center gap-4 w-full px-4 sm:px-6 lg:px-8 py-3">
          <div
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
          >
            <HiArrowLeft className="text-base" />
            {sm && <span>{t("Quay lại")}</span>}
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-center gap-2">
            <HiFilm className="text-xl text-primary" />
            <h1 className="text-base font-bold text-gray-800 m-0">{t("Film")}</h1>
          </div>
        </div>

        <div
          className="h-1"
          style={{ background: "linear-gradient(to right, #8b5cf6, #7c3aed, #6366f1)" }}
        />
      </div>

      <FilmPage hideHeader />
    </div>
  );
}
