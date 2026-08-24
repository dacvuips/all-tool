import { useTranslation } from "react-i18next";
import { HiSparkles } from "react-icons/hi";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { HomePromoButton } from "./home-promo-button";

export function HomeHero() {
  const { t } = useTranslation();

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="flex w-full min-w-0 flex-col items-start text-left">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold text-purple bg-white rounded-full border border-gray-200 sm:text-sm sm:mb-8">
          <HiSparkles className="text-sm text-purple" />
          <span>NEXT-GEN AI API 2026</span>
        </div>

        <h2
          className="mb-4 text-3xl font-bold tracking-tight text-gray-600 sm:mb-6 sm:text-4xl md:text-5xl lg:text-3xl xl:text-4xl"
          style={{ lineHeight: "1.1" }}
        >
          <span className="text-purple">{t("[Tools] ")}</span>
          {t("Generate Banana 2 & Veo 3")}
        </h2>

        <p className="mb-8 w-full text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg sm:mb-10">
          {t(
            "Cung cấp công cụ hỗ trợ tạo video Veo 3 và ảnh Banana 2, tạo kịch bản, sao chép video và hình ảnh  , đồng nhất nhân vật, lồng tiếng, edit video miễn phí tốt nhất"
          )}
        </p>

        <div className="flex justify-center w-full">
          <HomePromoButton
            variant="purple"
            href="/app/affiliate-video"
            text={`${t("Bắt đầu miễn phí")} >>`}
            icon={<GenerateAiIcon className="text-lg" />}
          />
        </div>
      </div>
    </div>
  );
}
