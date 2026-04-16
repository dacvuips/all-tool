import Link from "next/link";
import { useTranslation } from "react-i18next";
import { HiArrowRight, HiShoppingCart } from "react-icons/hi";
import { RiDownloadCloudLine } from "react-icons/ri";

export function HomeActionCards() {
  const { t } = useTranslation();

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Buy Card */}
          <Link
            href="/recaptcha"
            className="group relative overflow-hidden rounded-xl p-5 sm:p-6 transition-all duration-300 bg-white border border-gray-200 hover:border-primary hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-primary-light text-primary">
                <HiShoppingCart className="text-xl" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-gray-900">
                    {t("reCAPTCHA Token")}
                  </h3>
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-10 font-bold uppercase text-white"
                    style={{
                      background: "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)",
                    }}
                  >
                    🔥 HOT
                  </span>
                </div>
                <p className="text-xs sm:text-sm leading-relaxed text-gray-500">
                  {t(
                    "Cung cấp reCAPTCHA token phục vụ generate image banana 2 và video veo 3 hàng loạt miễn phí tốt nhất."
                  )}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 self-center">
                <HiArrowRight className="text-lg text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
              </div>
            </div>
          </Link>

          {/* Free Tools Card */}
          <Link
            href="/app/affiliate-video"
            className="group relative overflow-hidden rounded-xl p-5 sm:p-6 transition-all duration-300 bg-white border border-gray-200 hover:border-gray-400 hover:shadow-lg"
          >
            <div className="flex items-start gap-4">
              {/* Icon */}
              <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-gray-100 text-gray-600">
                <RiDownloadCloudLine className="text-xl" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-lg font-bold mb-1.5 text-gray-900">
                  {t("Generate Banana 2 & Veo 3 Tools")}
                </h3>
                <p className="text-xs sm:text-sm leading-relaxed text-gray-500">
                  {t(
                    "Công cụ hỗ trợ generate video veo 3 và image banana 2 hàng loạt miễn phí tốt nhất."
                  )}
                </p>
              </div>

              {/* Arrow */}
              <div className="flex-shrink-0 self-center">
                <HiArrowRight className="text-lg text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gray-600" />
              </div>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
