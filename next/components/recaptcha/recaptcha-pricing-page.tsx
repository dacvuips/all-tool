import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiCheck, HiShieldCheck } from "react-icons/hi";
import { useScreen } from "../../lib/hooks/useScreen";
import { SettingService } from "../../lib/repo/general/setting.repo";
import { RecaptchaSubscriptionPlanEnum } from "../../lib/repo/recaptcha-token/recaptcha-token.repo";
import { Spinner } from "../shared/utilities/misc";

interface RecaptchaPlan {
  id: string;
  label: string;
  icon: string;
  requestQuantity: number;
  duration: number; // days
  price: number;
  accentColor: string;
  badgeBg: string;
  badgeTextColor: string;
  borderColor: string;
  highlight?: boolean;
  badgeLabel?: string;
}

const PLAN_ORDER = [
  RecaptchaSubscriptionPlanEnum.BASIC,
  RecaptchaSubscriptionPlanEnum.STANDARD,
  RecaptchaSubscriptionPlanEnum.PROFESSIONAL,
  RecaptchaSubscriptionPlanEnum.UNLIMITED,
];

const PLAN_KEY_MAP: Record<string, RecaptchaSubscriptionPlanEnum> = {
  [RecaptchaSubscriptionPlanEnum.BASIC]: RecaptchaSubscriptionPlanEnum.BASIC,
  [RecaptchaSubscriptionPlanEnum.STANDARD]: RecaptchaSubscriptionPlanEnum.STANDARD,
  [RecaptchaSubscriptionPlanEnum.PROFESSIONAL]: RecaptchaSubscriptionPlanEnum.PROFESSIONAL,
  [RecaptchaSubscriptionPlanEnum.UNLIMITED]: RecaptchaSubscriptionPlanEnum.UNLIMITED,
};

export default function RecaptchaPricingPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<RecaptchaPlan[]>([]);
  /** Static styling metadata for each plan */
  const PLAN_STYLES: Record<string, Omit<RecaptchaPlan, "id" | "requestQuantity" | "price">> = {
    [RecaptchaSubscriptionPlanEnum.BASIC]: {
      label: t("Gói Cơ Bản"),
      icon: "🛡️",
      duration: 30,
      accentColor: "text-blue-600",
      badgeBg: "bg-blue-500",
      badgeTextColor: "text-white",
      borderColor: "border-blue-200",
      badgeLabel: "Phổ biến",
    },
    [RecaptchaSubscriptionPlanEnum.STANDARD]: {
      label: t("Gói Tiêu Chuẩn"),
      icon: "⚡",
      duration: 30,
      accentColor: "text-primary",
      badgeBg: "bg-primary",
      badgeTextColor: "text-white",
      borderColor: "border-primary",
      highlight: true,
      badgeLabel: "Hot",
    },
    [RecaptchaSubscriptionPlanEnum.PROFESSIONAL]: {
      label: t("Gói Chuyên Nghiệp"),
      icon: "🚀",
      duration: 30,
      accentColor: "text-green-600",
      badgeBg: "bg-green-500",
      badgeTextColor: "text-white",
      borderColor: "border-green-200",
      badgeLabel: "Chuyên nghiệp",
    },
    [RecaptchaSubscriptionPlanEnum.UNLIMITED]: {
      label: t("Gói Không Giới Hạn"),
      icon: "💎",
      duration: 30,
      accentColor: "text-yellow-600",
      badgeBg: "bg-yellow-500",
      badgeTextColor: "text-white",
      borderColor: "border-yellow-300",
      badgeLabel: "Best Value",
    },
  };

  // Load requestQuantity & price from rpk-* settings (dùng getSettingNotPrivate vì trang pricing là public)
  useEffect(() => {
    setLoading(true);
    SettingService.getSettingNotPrivate()
      .then((settings) => {
        const rpkSettings = settings.filter((s) => s.key?.startsWith("rpk-"));

        const loadedPlans: RecaptchaPlan[] = [];

        for (const planId of PLAN_ORDER) {
          const prefix = `rpk-${PLAN_KEY_MAP[planId]}`;
          const getValue = (suffix: string) => {
            const s = rpkSettings.find((x) => x.key === `${prefix}-${suffix}`);
            return s ? Number(s.value) : 0;
          };

          loadedPlans.push({
            id: planId,
            ...PLAN_STYLES[planId],
            requestQuantity: getValue("request-quantity"),
            price: getValue("price"),
          });
        }

        setPlans(loadedPlans);
      })
      .catch((err) => {
        console.error("Failed to load recaptcha pricing configs:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));
  const formatPrice = (n: number) => (n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + "đ");

  const getFeatures = (plan: RecaptchaPlan): string[] => {
    const features: string[] = [];
    features.push(`${formatNumber(plan.requestQuantity)} ${t("request")} / ${t("tháng")}`);
    features.push(`${t("Thời hạn")} ${plan.duration} ${t("ngày")}`);
    features.push(t("reCAPTCHA token Flow"));
    features.push(t("API Key riêng biệt"));
    features.push(t("Bảo mật cao"));
    return features;
  };
  if (loading) return <Spinner />;

  return (
    <div className="bg-gray-100 min-h-screen">
      {!hideHeader && (
        <>
          {/* Header */}
          <div className="sticky top-14 z-40 bg-white shadow-sm">
            <div className="flex items-center gap-4 max-w-screen-xl mx-auto px-6 py-3">
              <Link
                href="/recaptcha"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary"
              >
                <HiArrowLeft className="text-base" />
                {sm && <span>{t("Quay lại")}</span>}
              </Link>
              <div className="w-px h-5 bg-gray-300" />
              <div className="flex items-center gap-2">
                <HiShieldCheck className="text-xl text-green-500" />
                <h1 className="text-base font-bold text-gray-800 m-0">{t("Gói reCAPTCHA")}</h1>
              </div>
            </div>
            <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
          </div>
        </>
      )}

      {/* Hero */}
      <div className="text-center py-10 px-4">
        <div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4"
          style={{
            background:
              "linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(59, 130, 246, 0.1) 100%)",
            color: "#10b981",
          }}
        >
          <span>⚡</span> {t("Nâng tầm ứng dụng của bạn")}
        </div>
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3">
          {t("Chọn Gói Giải ReCAPTCHA Flow")}
        </h2>
        <p className="text-sm sm:text-base text-gray-500 max-w-lg mx-auto">
          {t(
            "Giải reCAPTCHA Flow giúp bạn vượt qua các bước xác minh captcha generate Image banana và Veo 3 nhanh chóng. Giúp bạn thực hiện những hình ảnh và video chất lượng cao với giá cả hợp lý."
          )}
        </p>
      </div>

      {/* Cards */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {plans.map((plan) => {
              const features = getFeatures(plan);
              const isHighlight = plan.highlight;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    isHighlight ? `${plan.borderColor} shadow-lg` : "border-gray-200 shadow-sm"
                  }`}
                >
                  {/* Badge */}
                  {plan.badgeLabel && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${plan.badgeBg} ${plan.badgeTextColor}`}
                      >
                        {t(plan.badgeLabel)}
                      </span>
                    </div>
                  )}

                  {/* Plan name & icon */}
                  <div className="flex items-center gap-3 mb-4 mt-2">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${plan.badgeBg} bg-opacity-10`}
                    >
                      {plan.icon}
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{t(plan.label)}</h3>
                  </div>

                  {/* Request count */}
                  <div className="mb-4">
                    <span className={`text-3xl font-extrabold ${plan.accentColor}`}>
                      {formatNumber(plan.requestQuantity)}
                    </span>
                    <span className="text-sm text-gray-500 ml-1.5">request / {t("tháng")}</span>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    <span className="text-xl font-bold text-gray-900">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="text-sm text-gray-400 ml-1">/{t("tháng")}</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="h-px bg-gray-100 mb-4" />

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6">
                    {features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                        <HiCheck className="text-green-500 text-base mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                      isHighlight
                        ? "text-white shadow-md hover:shadow-lg hover:opacity-90"
                        : "bg-gray-100 text-gray-800 hover:bg-gray-200"
                    }`}
                    style={
                      isHighlight
                        ? {
                            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                          }
                        : {}
                    }
                    onClick={() => router.push(`/checkout?type=recaptcha&subscription=${plan.id}`)}
                  >
                    {t("Mua Ngay")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Info Section */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
        <div className="bg-white rounded-2xl border border-gray-200 p-6 sm:p-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">{t("Tại sao cần reCAPTCHA?")}</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🤖</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  {t("Thuốc giải reCAPTCHA cho Flow")}
                </p>
                <p className="text-xs text-gray-500">
                  {t(
                    "Thuật toán giải mã reCAPTCHA giúp bạn vượt qua việc ngăn chặn generate Image/Video của Flow"
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⏱️</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">
                  {t("Tốc độ xử lý nhanh")}
                </p>
                <p className="text-xs text-gray-500">{t("Giải reCAPTCHA chỉ mất chưa đến 2s ")}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 mb-1">{t("Chịu tải cao")}</p>
                <p className="text-xs text-gray-500">
                  {t("Xử lý hàng ngàn request/giây đảm bảo không gián đoạn")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Footer */}
      <div className="text-center py-8 px-4">
        <p className="text-sm text-gray-600">{`${t("Liên hệ hỗ trợ")}: ${"Zalo: 037.7733.100"}`}</p>
        <p className="text-xs text-gray-400 mt-1">
          {t("Thanh toán qua chuyển khoản ngân hàng hoặc ví điện tử.")}
        </p>
      </div>
    </div>
  );
}
