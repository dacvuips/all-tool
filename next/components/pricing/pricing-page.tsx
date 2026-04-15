import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiCheck } from "react-icons/hi";
import { RiGiftLine, RiPriceTag3Line } from "react-icons/ri";
import { useAuth } from "../../lib/providers/auth-provider";
import { SubscriptionPlanEnum } from "../../lib/repo/customer/customer.repo";
import { Setting, SettingService } from "../../lib/repo/general/setting.repo";
import { Spinner } from "../shared/utilities/misc";

/** Map from SubscriptionPlanEnum value → lowercase key prefix used in settings */
const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.TRIAL]: "trial",
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.UNLIMITED]: "unlimited",
};

/** Plans to display on pricing page (excludes Free) */
const PLAN_ORDER = [
  SubscriptionPlanEnum.TRIAL,
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.UNLIMITED,
];

interface PlanConfig {
  plan: SubscriptionPlanEnum;
  videoLimit: number;
  imageLimit: number;
  imageStreamCount: number;
  videoStreamCount: number;
  price: number;
}

/** Plan display metadata */
const PLAN_META: Record<
  string,
  {
    label: string;
    icon: string;
    badgeColor: string;
    badgeTextColor: string;
    badgeBg: string;
    accentColor: string;
    borderColor: string;
    highlight?: boolean;
    badgeLabel?: string;
  }
> = {
  [SubscriptionPlanEnum.TRIAL]: {
    label: "Trial",
    icon: "📦",
    badgeColor: "bg-gray-100",
    badgeTextColor: "text-gray-700",
    badgeBg: "bg-gray-100",
    accentColor: "text-gray-700",
    borderColor: "border-gray-200",
    badgeLabel: "Dùng thử",
  },
  [SubscriptionPlanEnum.BASIC]: {
    label: "Gói Cơ Bản",
    icon: "⭐",
    badgeColor: "bg-blue-500",
    badgeTextColor: "text-white",
    badgeBg: "bg-blue-500",
    accentColor: "text-blue-600",
    borderColor: "border-blue-200",
    badgeLabel: "Phổ biến",
  },
  [SubscriptionPlanEnum.STANDARD]: {
    label: "Gói Tiêu Chuẩn",
    icon: "🔥",
    badgeColor: "bg-primary ",
    badgeTextColor: "text-white",
    badgeBg: "bg-primary  ",
    accentColor: "text-primary",
    borderColor: "border-primary",
    highlight: true,
    badgeLabel: "Hot",
  },
  [SubscriptionPlanEnum.PROFESSIONAL]: {
    label: "Gói Chuyên Nghiệp",
    icon: "🚀",
    badgeColor: "bg-green-500",
    badgeTextColor: "text-white",
    badgeBg: "bg-green-500",
    accentColor: "text-green-600",
    borderColor: "border-green-200",
    badgeLabel: "Chuyên nghiệp",
  },
  [SubscriptionPlanEnum.UNLIMITED]: {
    label: "Gói Không Giới Hạn",
    icon: "💎",
    badgeColor: "bg-yellow-500",
    badgeTextColor: "text-white",
    badgeBg: "bg-yellow-500",
    accentColor: "text-yellow-600",
    borderColor: "border-yellow-300",
    badgeLabel: "Best Value",
  },
};

export default function PricingPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const { customer } = useAuth();
  const [loading, setLoading] = useState(true);
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([]);

  useEffect(() => {
    setLoading(true);
    SettingService.getAll({
      query: { limit: 0, filter: { key: { $regex: "^pk-", $options: "i" } } },
    })
      .then((res) => {
        const settings = res.data as Setting[];
        const configs: PlanConfig[] = [];

        for (const plan of PLAN_ORDER) {
          const prefix = `pk-${PLAN_KEY_MAP[plan]}`;
          const getValue = (suffix: string) => {
            const s = settings.find((x) => x.key === `${prefix}-${suffix}`);
            return s ? Number(s.value) : 0;
          };

          configs.push({
            plan,
            videoLimit: getValue("video-limit"),
            imageLimit: getValue("image-limit"),
            imageStreamCount: getValue("image-stream-count"),
            videoStreamCount: getValue("video-stream-count"),
            price: getValue("price"),
          });
        }

        setPlanConfigs(configs);
      })
      .catch((err) => {
        console.error("Failed to load pricing configs:", err);
      })
      .finally(() => setLoading(false));
  }, []);

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));

  const formatPrice = (n: number) => (n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + "đ");

  const currentPlan = customer?.googlePackage?.subscription;

  const getFeatures = (config: PlanConfig): string[] => {
    const features: string[] = [];
    features.push(`${t("Tạo tối đa")} ${formatNumber(config.videoLimit)} video / ${t("ngày")}`);
    features.push(
      `${t("Tạo tối đa")} ${formatNumber(config.imageLimit)} ${t("hình ảnh")} / ${t("ngày")}`
    );
    features.push(
      `${t("Tối đa")} ${formatNumber(config.videoStreamCount)} ${t("luồng video cùng lúc")}`
    );
    features.push(
      `${t("Tối đa")} ${formatNumber(config.imageStreamCount)} ${t("luồng tạo ảnh cùng lúc")}`
    );
    features.push(t("Không giới hạn câu prompt chuyển động"));
    return features;
  };

  return (
    <div className="pricing-page">
      {/* Header */}
      <div className="pricing-header">
        <div className="pricing-header__inner">
          <Link href="/" className="pricing-header__back">
            <HiArrowLeft className="pricing-header__back-icon" />
            <span>{t("Quay lại")}</span>
          </Link>
          <div className="pricing-header__divider" />
          <div className="pricing-header__title">
            <RiPriceTag3Line className="pricing-header__title-icon" />
            <h1>{t("Bảng Giá Dịch Vụ")}</h1>
          </div>
        </div>
      </div>

      {/* Hero */}
      <div className="pricing-hero">
        <div className="pricing-hero__badge">
          <span>🎁</span> {t("Miễn phí 1 ngày dùng thử")}
        </div>
        <h2 className="pricing-hero__title">{t("Chọn Gói Phù Hợp Với Bạn")}</h2>
        <p className="pricing-hero__subtitle">
          {t(
            "Trải nghiệm toàn bộ sức mạnh AI trong sáng tạo video. Càng dùng lâu, càng tiết kiệm."
          )}
        </p>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : (
        <div className="pricing-cards">
          {planConfigs.map((config) => {
            const meta = PLAN_META[config.plan];
            const isCurrent = currentPlan === config.plan;
            const features = getFeatures(config);
            const isHighlight = meta.highlight;

            return (
              <div
                key={config.plan}
                className={`pricing-card ${isHighlight ? "pricing-card--highlight" : ""} ${
                  isCurrent ? "pricing-card--current" : ""
                }`}
              >
                {/* Plan name & icon */}
                <div className="pricing-card__name">
                  <div
                    className={`pricing-card__name-icon ${meta.accentColor} ${meta.badgeBg} p-1 rounded-md`}
                  >
                    {config.plan === SubscriptionPlanEnum.TRIAL && "📦"}
                    {config.plan === SubscriptionPlanEnum.BASIC && "⭐"}
                    {config.plan === SubscriptionPlanEnum.STANDARD && "⚡"}
                    {config.plan === SubscriptionPlanEnum.PROFESSIONAL && "🚀"}
                    {config.plan === SubscriptionPlanEnum.UNLIMITED && "💎"}
                  </div>
                  <h3>{t(meta.label)}</h3>
                </div>

                {/* Video count per day */}
                <div className="pricing-card__video-count">
                  <span className={`pricing-card__video-number ${meta.accentColor}`}>
                    {formatNumber(config.videoLimit)}
                  </span>
                  <span className="pricing-card__video-label">video / {t("ngày")}</span>
                </div>

                {/* Price */}
                <div className="pricing-card__price">
                  <span className="pricing-card__price-amount">{formatPrice(config.price)}</span>
                  {config.price > 0 && (
                    <span className="pricing-card__price-period">/{t("tháng")}</span>
                  )}
                </div>

                {/* Divider */}
                <div className="pricing-card__divider" />

                {/* Features */}
                <ul className="pricing-card__features">
                  {features.map((feature, i) => (
                    <li key={i} className="pricing-card__feature">
                      <HiCheck className="pricing-card__feature-icon" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                <div className="pricing-card__cta">
                  {isCurrent ? (
                    <button className="pricing-card__btn pricing-card__btn--current" disabled>
                      {t("Đang sử dụng")}
                    </button>
                  ) : config.plan === SubscriptionPlanEnum.TRIAL ? (
                    <button className="pricing-card__btn pricing-card__btn--current" disabled>
                      {t("Liên hệ admin")}
                    </button>
                  ) : (
                    <button
                      className={`pricing-card__btn ${
                        isHighlight ? "pricing-card__btn--highlight" : "pricing-card__btn--default"
                      }`}
                      onClick={() => router.push(`/checkout?subscription=${config.plan}`)}
                    >
                      {t("Đăng Ký Ngay")}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Referral Banner */}
      <div className="pricing-referral">
        <div className="pricing-referral__inner">
          <div className="pricing-referral__badge">
            <RiGiftLine /> {t("Chương Trình Giới Thiệu")}
          </div>
          <h2 className="pricing-referral__title">{t("Hoa Hồng Trọn Đời")}</h2>
          <p className="pricing-referral__desc">
            {t("Giới thiệu bạn bè đăng ký gói và nhận hoa hồng cho mỗi gói được kích hoạt.")}
          </p>

          {/* Commission Tiers */}
          <div className="pricing-referral__tiers">
            <div className="pricing-referral__tier">
              <span className="pricing-referral__tier-percent">10%</span>
              <span className="pricing-referral__tier-label">
                {t("Hoa hồng cho mỗi đơn hàng kích hoạt thành công")}
              </span>
            </div>
          </div>

          {/* Feature Badges */}
          <div className="pricing-referral__features">
            <div className="pricing-referral__feature-badge">
              <span>👥</span> {t("Không giới hạn số người giới thiệu")}
            </div>
            <div className="pricing-referral__feature-badge">
              <span>📈</span> {t("Thanh toán hàng tháng")}
            </div>
          </div>
        </div>
      </div>

      {/* Contact Footer */}
      <div className="pricing-contact">
        <p className="pricing-contact__line">
          {t("Liên hệ hỗ trợ:")} <strong>Zalo: 037.7733.100</strong>
        </p>
        <p className="pricing-contact__line pricing-contact__line--sub">
          {t("Thanh toán qua chuyển khoản ngân hàng hoặc ví điện tử.")}
        </p>
      </div>
    </div>
  );
}
