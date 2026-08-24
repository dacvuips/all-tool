import { Trans, useTranslation } from "react-i18next";
import { HiKey } from "react-icons/hi";
import { HomePromoButton } from "./home-promo-button";

export function HomeApiPromo() {
  const { t } = useTranslation();

  return (
    <div className="flex w-full min-w-0 flex-col">
      <div className="flex w-full min-w-0 flex-col items-start text-left">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 text-xs font-semibold text-orange bg-white rounded-full border border-gray-200 sm:text-sm sm:mb-8">
          <HiKey className="text-sm text-orange" />
          <span>API Media</span>
        </div>

        <h2
          className="mb-4 text-3xl font-bold tracking-tight text-gray-600 sm:mb-6 sm:text-4xl md:text-5xl lg:text-3xl xl:text-4xl"
          style={{ lineHeight: "1.1" }}
        >
          <Trans
            i18nKey="[API] Tích hợp Banana & Veo"
            defaults="<accent>[API]</accent> Tích hợp Banana & Veo"
            components={{ accent: <span className="text-orange" /> }}
          />
        </h2>

        <p className="mb-8 w-full text-sm leading-relaxed text-gray-500 sm:text-base md:text-lg sm:mb-10">
          {t(
            "REST API tạo ảnh và video theo luồng async — enqueue job, poll kết quả, upsample 4K. Một API key, 100 request test miễn phí, ví dụ sẵn Node / Curl / Python."
          )}
        </p>

        <div className="flex justify-center w-full">
          <HomePromoButton
            variant="orange"
            href="/api-generate-media"
            text={`${t("Lấy API Key")} >>`}
            icon={<HiKey className="text-lg" />}
          />
        </div>
      </div>
    </div>
  );
}
