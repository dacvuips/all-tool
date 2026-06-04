import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiCheck, HiShieldCheck } from "react-icons/hi";
import { useScreen } from "../../lib/hooks/useScreen";
import { ApiMediaSubscriptionPlanEnum } from "../../lib/repo/api-media-token/api-media-token.repo";
import { SettingService } from "../../lib/repo/general/setting.repo";
import { Spinner } from "../shared/utilities/misc";

interface ApiMediaPlan {
  id: string;
  label: string;
  icon: string;
  requestQuantity: number;
  duration: number; // days
  price: number;
  /** Hex color for accent text (request count) */
  accentColor: string;
  /** Hex color for badge background */
  badgeBg: string;
  /** Hex color for border when highlighted */
  borderColor: string;
  /** Hex color for icon background (light tint) */
  iconBg: string;
  highlight?: boolean;
  badgeLabel?: string;
}

const PLAN_ORDER = [
  ApiMediaSubscriptionPlanEnum.BASIC,
  ApiMediaSubscriptionPlanEnum.STANDARD,
  ApiMediaSubscriptionPlanEnum.PROFESSIONAL,
  ApiMediaSubscriptionPlanEnum.UNLIMITED,
];

const PLAN_KEY_MAP: Record<string, ApiMediaSubscriptionPlanEnum> = {
  [ApiMediaSubscriptionPlanEnum.BASIC]: ApiMediaSubscriptionPlanEnum.BASIC,
  [ApiMediaSubscriptionPlanEnum.STANDARD]: ApiMediaSubscriptionPlanEnum.STANDARD,
  [ApiMediaSubscriptionPlanEnum.PROFESSIONAL]: ApiMediaSubscriptionPlanEnum.PROFESSIONAL,
  [ApiMediaSubscriptionPlanEnum.UNLIMITED]: ApiMediaSubscriptionPlanEnum.UNLIMITED,
};

export default function ApiMediaPricingPage({ hideHeader = false }: { hideHeader?: boolean }) {
  const { t } = useTranslation();
  const router = useRouter();
  const sm = useScreen("sm");
  const [loading, setLoading] = useState(true);
  const [plans, setPlans] = useState<ApiMediaPlan[]>([]);
  /** Static styling metadata for each plan – all colors are hex for inline styles */
  const PLAN_STYLES: Record<string, Omit<ApiMediaPlan, "id" | "requestQuantity" | "price">> = {
    [ApiMediaSubscriptionPlanEnum.BASIC]: {
      label: t("Gói Cơ Bản"),
      icon: "🛡️",
      duration: 30,
      accentColor: "#0891b2", // cyan-600
      badgeBg: "#06b6d4", // cyan-500
      borderColor: "#a5f3fc", // cyan-200
      iconBg: "#ecfeff", // cyan-50
      badgeLabel: "Phổ biến",
    },
    [ApiMediaSubscriptionPlanEnum.STANDARD]: {
      label: t("Gói Tiêu Chuẩn"),
      icon: "⚡",
      duration: 30,
      accentColor: "#7c3aed", // violet-600
      badgeBg: "#7c3aed", // violet-600
      borderColor: "#a78bfa", // violet-400
      iconBg: "#f5f3ff", // violet-50
      highlight: true,
      badgeLabel: "Hot",
    },
    [ApiMediaSubscriptionPlanEnum.PROFESSIONAL]: {
      label: t("Gói Chuyên Nghiệp"),
      icon: "🚀",
      duration: 30,
      accentColor: "#e11d48", // rose-600
      badgeBg: "#f43f5e", // rose-500
      borderColor: "#fecdd3", // rose-200
      iconBg: "#fff1f2", // rose-50
      badgeLabel: "Chuyên nghiệp",
    },
    [ApiMediaSubscriptionPlanEnum.UNLIMITED]: {
      label: t("Gói Không Giới Hạn"),
      icon: "💎",
      duration: 30,
      accentColor: "#d97706", // amber-600
      badgeBg: "#f59e0b", // amber-500
      borderColor: "#fcd34d", // amber-300
      iconBg: "#fffbeb", // amber-50
      badgeLabel: "Best Value",
    },
  };

  // Load requestQuantity & price from ampk-* settings (dùng getSettingNotPrivate vì trang pricing là public)
  useEffect(() => {
    setLoading(true);
    SettingService.getSettingNotPrivate()
      .then((settings) => {
        const rpkSettings = settings.filter((s) => s.key?.startsWith("ampk-"));

        const loadedPlans: ApiMediaPlan[] = [];

        for (const planId of PLAN_ORDER) {
          const prefix = `ampk-${PLAN_KEY_MAP[planId]}`;
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
        console.error("Failed to load api-media pricing configs:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));
  const formatPrice = (n: number) => (n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + "đ");

  const getFeatures = (plan: ApiMediaPlan): string[] => {
    const features: string[] = [];
    features.push(t("Generate Image Banana 2 & Video Veo 3 "));
    features.push(`${t("Thời hạn")} ${plan.duration} ${t("ngày")}`);
    features.push(t("API Key riêng biệt"));
    features.push(t("Chiệu tải cao  "));
    return features;
  };
  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-gray-100">
      {!hideHeader && (
        <>
          {/* Header */}
          <div className="sticky top-14 z-40 bg-white shadow-sm">
            <div className="flex gap-4 items-center px-6 py-3 mx-auto max-w-screen-xl">
              <Link
                href="/api-generate-media"
                className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary"
              >
                <HiArrowLeft className="text-base" />
                {sm && <span>{t("Quay lại")}</span>}
              </Link>
              <div className="w-px h-5 bg-gray-300" />
              <div className="flex gap-2 items-center">
                <HiShieldCheck className="text-xl" style={{ color: "#7c3aed" }} />
                <h1 className="m-0 text-base font-bold text-gray-800">{t("Gói API Media")}</h1>
              </div>
            </div>
            <div
              className="h-[3px]"
              style={{ background: "linear-gradient(to right, #8b5cf6, #7c3aed, #6366f1)" }}
            />
          </div>
        </>
      )}

      {/* Hero */}
      <div className="px-4 py-10 text-center">
        <div
          className="inline-flex gap-2 items-center px-4 py-2 mb-4 text-sm font-semibold rounded-full"
          style={{
            background:
              "linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(236, 72, 153, 0.10) 100%)",
            color: "#7c3aed",
          }}
        >
          <span>⚡</span> {t("Nâng tầm ứng dụng của bạn")}
        </div>
        <h2 className="mb-3 text-2xl font-bold text-gray-900 sm:text-3xl">
          {t("Chọn Gói Giải API Media")}
        </h2>
        <p className="mx-auto max-w-lg text-sm text-gray-500 sm:text-base">
          {t(
            "Giải API Media giúp bạn tiết kiệm thời gian và chi phí khi sử dụng API generate Image Banana 2 và Veo 3. Giúp bạn thực hiện những hình ảnh và video chất lượng cao với giá cả hợp lý."
          )}
        </p>
      </div>

      {/* Cards */}
      <div className="px-4 pb-10 mx-auto max-w-6xl sm:px-6 lg:px-8">
        {loading ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {plans.map((plan) => {
              const features = getFeatures(plan);
              const isHighlight = plan.highlight;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl border-2 p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                    isHighlight ? "shadow-lg" : "border-gray-200 shadow-sm"
                  }`}
                  style={isHighlight ? { borderColor: plan.borderColor } : {}}
                >
                  {/* Badge */}
                  {plan.badgeLabel && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span
                        className="inline-flex items-center px-3 py-1 text-xs font-bold text-white rounded-full"
                        style={{ backgroundColor: plan.badgeBg }}
                      >
                        {t(plan.badgeLabel)}
                      </span>
                    </div>
                  )}

                  {/* Plan name & icon */}
                  <div className="flex gap-3 items-center mt-2 mb-4">
                    <div
                      className="flex justify-center items-center w-10 h-10 text-lg rounded-lg"
                      style={{ backgroundColor: plan.iconBg }}
                    >
                      {plan.icon}
                    </div>
                    <h3 className="text-base font-bold text-gray-900">{t(plan.label)}</h3>
                  </div>

                  {/* Request count */}
                  <div className="mb-4">
                    <span className="text-3xl font-extrabold" style={{ color: plan.accentColor }}>
                      {formatNumber(plan.requestQuantity)}
                    </span>
                    <span className="text-sm text-gray-500 ml-1.5">
                      {t("lượt tạo")} / {t("tháng")}
                    </span>
                  </div>

                  {/* Price */}
                  <div className="mb-5">
                    <span className="text-xl font-bold text-gray-900">
                      {formatPrice(plan.price)}
                    </span>
                    {plan.price > 0 && (
                      <span className="ml-1 text-sm text-gray-400">/{t("tháng")}</span>
                    )}
                  </div>

                  {/* Divider */}
                  <div className="mb-4 h-px bg-gray-100" />

                  {/* Features */}
                  <ul className="space-y-2.5 mb-6">
                    {features.map((feature, i) => (
                      <li key={i} className="flex gap-2 items-start text-sm text-gray-600">
                        <HiCheck
                          className="text-base mt-0.5 flex-shrink-0"
                          style={{ color: plan.accentColor }}
                        />
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
                            background: "linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)",
                          }
                        : {}
                    }
                    onClick={() => router.push(`/checkout?type=api-media&subscription=${plan.id}`)}
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
      <div className="px-4 pb-10 mx-auto max-w-6xl sm:px-6 lg:px-8">
        <div className="p-6 bg-white rounded-2xl border border-gray-200 sm:p-8">
          <h3 className="mb-4 text-lg font-bold text-gray-900">{t("Tại sao cần API Media?")}</h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex gap-3 items-start">
              <span className="text-2xl">💰</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-800">{t("Tiết kiệm chi phí")}</p>
                <p className="text-xs text-gray-500">
                  {t(
                    "Chi phí sử dụng khi gen Banana 2 /Veo 3 của các gói thấp hơn so với việc mua lẻ"
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-2xl">🛡️</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-800">{t("Đề phòng lừa đảo")}</p>
                <p className="text-xs text-gray-500">
                  {t(
                    "Nhiều đơn vị lừa đảo, giả mạo bán API gen Video/ảnh, cần test để tránh mất tiền oan. Chúng tôi cho phép test trước khi mua."
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-3 items-start">
              <span className="text-2xl">⚡</span>
              <div>
                <p className="mb-1 text-sm font-semibold text-gray-800">{t("Chịu tải cao")}</p>
                <p className="text-xs text-gray-500">
                  {t("Xử lý hàng ngàn request/giây đảm bảo không gián đoạn")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Contact Footer */}
      <div className="px-4 py-8 text-center">
        <p className="mt-1 text-xs text-gray-400">
          {t("Thanh toán qua chuyển khoản ngân hàng hoặc ví điện tử.")}
        </p>
      </div>
    </div>
  );
}
