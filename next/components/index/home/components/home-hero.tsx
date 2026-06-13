import { useTranslation } from "react-i18next";
import { HiSparkles } from "react-icons/hi";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";
import { Button } from "../../../shared/utilities/form";

export function HomeHero() {
  const { t } = useTranslation();

  return (
    <section className="flex overflow-hidden relative flex-col justify-center items-center px-4 py-8 bg-white border-b border-dashed sm:py-8 md:py-12 border-primary">
      {/* Subtle gradient overlay */}
      <div
        className="absolute inset-0 opacity-30"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(242, 137, 13, 0.15) 0%, transparent 60%)",
        }}
      />

      {/* Subtle grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-5"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="flex relative z-10 flex-col items-center mx-auto max-w-3xl text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-6 sm:mb-8 bg-primary-light text-primary border border-primary border-opacity-20">
          <HiSparkles className="text-sm" />
          <span>NEXT-GEN AI API 2026</span>
        </div>

        {/* Title */}
        <h1
          className="mb-4 text-4xl font-extrabold tracking-tight text-gray-600 sm:text-5xl md:text-6xl lg:text-5xl sm:mb-6"
          style={{ lineHeight: "1.1" }}
        >
          <span className="text-primary"> {t("[Tools] ")}</span>
          {t("Generate Banana 2 & Veo 3")}
        </h1>

        {/* Description */}
        <p className="mx-auto mb-8 max-w-xl text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg sm:mb-10">
          {t(
            "Cung cấp công cụ hỗ trợ tạo video Veo 3 và ảnh Banana 2, tạo kịch bản, sao chép video và hình ảnh  , đồng nhất nhân vật, lồng tiếng, edit video miễn phí tốt nhất"
          )}
        </p>

        {/* CTA Button */}

        <Button
          primary
          text={`${t("Bắt đầu miễn phí")} >>`}
          icon={<GenerateAiIcon className="text-lg" />}
          href="/app/affiliate-video"
        />
      </div>
    </section>
  );
}
