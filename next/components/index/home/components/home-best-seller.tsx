import Link from "next/link";
import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiLightningBolt } from "react-icons/hi";

export function HomeBestSeller() {
  const { t } = useTranslation();

  const features = [
    t("Access Veo 3.1 & Imagen 3"),
    t("4K Ultra Fast Video Quality"),
    t("Advanced Image-to-Video Support"),
  ];

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="max-w-4xl mx-auto">
        <div className="relative overflow-hidden rounded-2xl p-6 sm:p-8 lg:p-10 bg-white border border-primary border-dashed shadow-sm">
          {/* Subtle corner glow */}
          <div
            className="absolute top-0 right-0 w-64 h-64 opacity-20"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(242, 137, 13, 0.15) 0%, transparent 60%)",
            }}
          />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6 lg:gap-10">
            {/* Left Content */}
            <div className="flex-1">
              {/* Best Seller Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 sm:mb-5 bg-primary-light text-primary border border-primary border-opacity-20">
                <HiLightningBolt className="text-sm" />
                <span>{t("Best Seller")}</span>
              </div>

              {/* Product Title */}
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold mb-3 tracking-tight text-gray-900">
                Google Veo 3 Ultra Account
              </h2>

              {/* Product Description */}
              <p className="text-sm sm:text-base mb-5 sm:mb-6 leading-relaxed max-w-lg text-gray-500">
                {t(
                  "Experience unlimited AI Video creation power directly on the Google interface."
                )}
              </p>

              {/* Features Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 sm:gap-3">
                {features.map((feature, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <HiCheckCircle className="flex-shrink-0 text-base text-primary" />
                    <span className="text-xs sm:text-sm font-medium text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right - Price & CTA */}
            <div className="flex flex-col items-start lg:items-end gap-4 lg:min-w-max">
              {/* Price */}
              <div className="flex flex-col items-start lg:items-end">
                <span className="text-xs sm:text-sm mb-1 text-gray-400">{t("From only")}</span>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-gray-900">
                    79.000
                  </span>
                  <span
                    className="text-base sm:text-lg font-bold relative text-gray-900"
                    style={{ top: "-1.2em" }}
                  >
                    đ
                  </span>
                </div>
                <span className="text-sm -mt-1 text-gray-400 italic">/{t("tháng")}</span>
              </div>

              {/* CTA Button */}
              <Link
                href="/products"
                className="inline-flex items-center justify-center px-8 py-3 rounded-lg text-sm sm:text-base font-bold transition-all duration-300 text-white hover:shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)",
                  minWidth: "160px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #ffa033 0%, #F2890D 100%)";
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(242, 137, 13, 0.3)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)";
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "none";
                }}
              >
                {t("Buy Now")}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
