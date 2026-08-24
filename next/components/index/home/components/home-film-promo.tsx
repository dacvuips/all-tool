import { Trans, useTranslation } from "react-i18next";
import { RiFilmFill } from "react-icons/ri";
import { HomePromoButton } from "./home-promo-button";

export function HomeFilmPromo() {
  const { t } = useTranslation();

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="flex w-full min-w-0 flex-col items-start text-left">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold text-rose bg-white rounded-full border border-gray-200 sm:text-sm sm:mb-8">
          <RiFilmFill className="text-sm text-rose" />
          <span>Film Studio</span>
        </div>

        <h2
          className="mb-4 text-3xl font-bold tracking-tight text-gray-600 sm:mb-6 sm:text-4xl md:text-5xl lg:text-3xl xl:text-4xl"
          style={{ lineHeight: "1.1" }}
        >
          <Trans
            i18nKey="[Film] Làm phim AI chuyên nghiệp"
            defaults="<accent>[Film]</accent> Làm phim AI chuyên nghiệp"
            components={{ accent: <span className="text-rose" /> }}
          />
        </h2>

        <p className="mb-8 w-full text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg sm:mb-10">
          {t(
            "Sản xuất phim ngắn từ kịch bản: nhân vật đồng nhất, storyboard, tạo video Veo, lồng tiếng và timeline — quản lý toàn bộ dự án trong một studio."
          )}
        </p>

        <div className="flex justify-center w-full">
          <HomePromoButton
            variant="rose"
            href="/film"
            text={`${t("Bắt đầu làm phim")} >>`}
            icon={<RiFilmFill className="text-lg" />}
          />
        </div>
      </div>
    </div>
  );
}
