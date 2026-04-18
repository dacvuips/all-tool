import Link from "next/link";
import { useTranslation } from "react-i18next";
import { FaPhotoVideo } from "react-icons/fa";
import { HiArrowRight, HiKey } from "react-icons/hi";
import { GenerateAiIcon } from "../../../../public/assets/svg/generate-ai";

export function HomeActionCards() {
  const { t } = useTranslation();

  return (
    <section className="px-4 sm:px-6 lg:px-8 py-4">
      <div className="max-w-4xl mx-auto">
        {/* Free Tools Card */}
        <div
          className="mb-4"
          style={{
            position: "relative",
            overflow: "hidden",
            borderRadius: "0.75rem",
            padding: "1px",
          }}
        >
          <style>{`
            @keyframes rainbowSpin {
              0% { transform: translate(-50%, -50%) rotate(0deg); }
              100% { transform: translate(-50%, -50%) rotate(-360deg); }
            }
          `}</style>
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: "50%",
              width: "2000px",
              height: "2000px",
              background:
                "conic-gradient(from 90deg at 50% 50%, #ff0000, #ff7f00, #ffff00, #00ff00, #0000ff, #4b0082, #8b00ff, #ff0000)",
              animation: "rainbowSpin 5s linear infinite",
            }}
          />
          <Link
            href="/app/affiliate-video"
            className="block group relative p-5 sm:p-6 transition-all duration-300 hover:shadow-lg"
            style={{
              height: "100%",
              width: "100%",
              backgroundColor: "white",
              borderRadius: "0.65rem",
              zIndex: 10,
            }}
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-pink-light text-pink-500">
                  <GenerateAiIcon className="text-xl text-pink-500" />
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-pink truncate">
                    {t("[Tools] - Generate Banana 2 & Veo 3")}
                  </h3>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0">
                  <HiArrowRight className="text-lg text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gray-600" />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm leading-relaxed text-gray-500">
                {t(
                  "Cung cấp công cụ hỗ trợ generate video Veo 3 và image Banana 2, tạo kịch bản, Copy, đồng nhất nhân vật, lồng tiếng, edit video miễn phí tốt nhất. Click để trải nghiệm ngay!"
                )}
              </p>
            </div>
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Buy Card */}
          <Link
            href="/recaptcha"
            className="block group relative overflow-hidden rounded-xl p-5 sm:p-6 transition-all duration-300 bg-white border border-gray-200 hover:border-primary hover:shadow-lg"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-success-light text-success-light">
                  <HiKey className="text-xl text-success" />
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base sm:text-lg font-bold text-success-dark truncate">
                      {t("reCAPTCHA Token (Flow)")}
                    </h3>
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-10 font-bold uppercase text-white flex-shrink-0"
                      style={{
                        background: "linear-gradient(135deg, #F2890D 0%, #e07b00 100%)",
                      }}
                    >
                      🔥 HOT
                    </span>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0">
                  <HiArrowRight className="text-lg text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-primary" />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm leading-relaxed text-gray-500">
                {t(
                  "Cung cấp reCAPTCHA token phục vụ generate image banana 2 và video veo 3 hàng loạt miễn phí tốt nhất. Click để trải nghiệm ngay!"
                )}
              </p>
            </div>
          </Link>

          {/* Free Tools Card */}
          <Link
            href="/app/affiliate-video"
            className="block group relative overflow-hidden rounded-xl p-5 sm:p-6 transition-all duration-300 bg-white border border-gray-200 hover:border-primary hover:shadow-lg"
          >
            <div className="flex flex-col">
              <div className="flex items-center gap-4 mb-3">
                {/* Icon */}
                <div className="flex-shrink-0 w-11 h-11 rounded-xl flex items-center justify-center bg-danger-light text-gray-600">
                  <FaPhotoVideo className="text-xl text-danger" />
                </div>

                {/* Title */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-danger-dark truncate">
                    {t("[API] - Generate Banana 2 & Veo 3")}
                  </h3>
                </div>

                {/* Arrow */}
                <div className="flex-shrink-0">
                  <HiArrowRight className="text-lg text-gray-300 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-gray-600" />
                </div>
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm leading-relaxed text-gray-500">
                {t(
                  "Cung cấp API hỗ trợ generate video veo 3 và image Banana 2 miễn phí tốt nhất. Click để trải nghiệm ngay!"
                )}
              </p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
