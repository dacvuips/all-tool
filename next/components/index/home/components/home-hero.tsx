import { useTranslation } from "react-i18next";
import { HiSparkles } from "react-icons/hi";

export function HomeHero() {
  const { t } = useTranslation();

  return (
    <section className="relative overflow-hidden flex flex-col items-center justify-center px-4 py-8 sm:py-8 md:py-12 bg-white  border-primary border-b border-dashed">
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

      <div className="relative flex flex-col items-center max-w-3xl mx-auto text-center z-10">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-6 sm:mb-8 bg-primary-light text-primary border border-primary border-opacity-20">
          <HiSparkles className="text-sm" />
          <span>NEXT-GEN AI API 2026</span>
        </div>

        {/* Title */}
        <h1
          className="text-4xl sm:text-5xl md:text-6xl lg:text-5xl font-extrabold tracking-tight mb-4 sm:mb-6 text-gray-600"
          style={{ lineHeight: "1.1" }}
        >
          AI Video Generator
          <span className="text-primary"> Tools</span>
        </h1>

        {/* Description */}
        <p className="text-sm sm:text-base md:text-lg max-w-xl mx-auto mb-8 sm:mb-10 leading-relaxed text-gray-500">
          {t(
            "Optimal API solution for Google Veo 3 and Imagen 3. High speed, low cost, easy integration into your app."
          )}
        </p>

        {/* CTA Button
        <Link
          href="/app/affiliate-video"
          className="inline-flex items-center gap-2.5 px-6 py-3 rounded-full text-sm sm:text-base font-semibold transition-all duration-300 border border-gray-300 text-gray-700 bg-white hover:border-primary hover:text-primary hover:shadow-md"
        >
          <HiCode className="text-lg" />
          <span>{t("Start integrating")}</span>
        </Link> */}
      </div>
    </section>
  );
}
