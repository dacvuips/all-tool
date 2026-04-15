import { useRouter } from "next/router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiArrowLeft, HiCheck } from "react-icons/hi";
import { RiSecurePaymentLine } from "react-icons/ri";
import { parseNumber } from "../../../../lib/helpers/parser";
import { useToast } from "../../../../lib/providers/toast-provider";
import { SubscriptionPlanEnum } from "../../../../lib/repo/customer/customer.repo";
import { Setting, SettingService } from "../../../../lib/repo/general/setting.repo";
import { orderService, PaymentMethod } from "../../../../lib/repo/order/order.repo";
import { Label } from "../../../shared/utilities/form";
import { Button } from "../../../shared/utilities/form/button";
import { Spinner } from "../../../shared/utilities/misc";
import { useCheckoutContext } from "../provider/checkout-provider";

/** Map from SubscriptionPlanEnum value → lowercase key prefix used in settings */
const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.UNLIMITED]: "unlimited",
};

/** Plans to display (excludes Free) */
const PLAN_ORDER = [
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
    accentColor: string;
    accentBg: string;
    borderActive: string;
    highlight?: boolean;
    badgeLabel?: string;
  }
> = {
  [SubscriptionPlanEnum.BASIC]: {
    label: "Gói Cơ Bản",
    icon: "⭐",
    accentColor: "text-blue-600",
    accentBg: "bg-blue-50",
    borderActive: "border-blue-500",
    badgeLabel: "Phổ biến",
  },
  [SubscriptionPlanEnum.STANDARD]: {
    label: "Gói Tiêu Chuẩn",
    icon: "⚡",
    accentColor: "text-primary",
    accentBg: " bg-gray-100",
    borderActive: "border-primary",
    highlight: true,
    badgeLabel: "Hot",
  },
  [SubscriptionPlanEnum.PROFESSIONAL]: {
    label: "Gói Chuyên Nghiệp",
    icon: "🚀",
    accentColor: "text-green-600",
    accentBg: "bg-green-50",
    borderActive: "border-green-500",
    badgeLabel: "Chuyên nghiệp",
  },
  [SubscriptionPlanEnum.UNLIMITED]: {
    label: "Gói Không Giới Hạn",
    icon: "💎",
    accentColor: "text-yellow-600",
    accentBg: "bg-yellow-50",
    borderActive: "border-yellow-500",
    badgeLabel: "Best Value",
  },
};

export function CheckoutPaymentForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const { order, loading } = useCheckoutContext();

  // Plan configs loaded from settings
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);

  // Selected plan
  const [selectedPlan, setSelectedPlan] = useState<SubscriptionPlanEnum | null>(null);

  // Payment method
  const PAYMENT_METHOD_OPTIONS: {
    value: PaymentMethod;
    label: string;
    description: string;
    icon: string;
  }[] = [
    {
      value: PaymentMethod.SEPAY_PG,
      label: t("Cổng thanh toán"),
      description: t("Thanh toán nhanh qua thẻ ngân hàng, QR NAPAS, Internet Banking"),
      icon: "💳",
    },
  ];

  const [selectedPaymentType, setSelectedPaymentType] = useState<PaymentMethod>(
    PaymentMethod.SEPAY_PG
  );

  // Loading for SePay PG redirect
  const [sePayLoading, setSePayLoading] = useState(false);

  // Load plan configs from settings
  useEffect(() => {
    setLoadingPlans(true);
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

        // Auto-select plan from URL param `subscription`, fallback to first plan
        const subscriptionParam = router.query.subscription as string | undefined;
        if (subscriptionParam && configs.some((c) => c.plan === subscriptionParam)) {
          setSelectedPlan(subscriptionParam as SubscriptionPlanEnum);
        } else if (configs.length > 0) {
          setSelectedPlan(configs[0].plan);
        }
      })
      .catch((err) => {
        console.error("Failed to load plan configs:", err);
        toast.error(t("Không thể tải danh sách gói. Vui lòng thử lại."));
      })
      .finally(() => setLoadingPlans(false));
  }, []);

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));
  const formatPrice = (n: number) => (n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + "đ");

  const selectedConfig = planConfigs.find((c) => c.plan === selectedPlan) || null;

  /** Thanh toán qua cổng SePay PG */
  const handleSePayPGCheckout = async () => {
    if (!selectedPlan) return;
    setSePayLoading(true);
    try {
      const data = await orderService.createSePayPGCheckout(selectedPlan);

      const formFields: Record<string, string> = JSON.parse(data.formFieldsJson);

      const form = document.createElement("form");
      form.method = "POST";
      form.action = data.checkoutUrl;

      Object.entries(formFields).forEach(([name, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = String(value);
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();
    } catch (err) {
      console.error("Lỗi tạo checkout:", err);
      toast.error("Không thể kết nối cổng thanh toán. Vui lòng thử lại.");
      setSePayLoading(false);
    }
  };

  /** Xử lý khi click nút thanh toán */
  const handleCheckout = async () => {
    handleSePayPGCheckout();
  };

  const isLoading = loading || sePayLoading;

  if (isLoading && !order) {
    return (
      <div className="flex flex-col min-h-[60vh] justify-center items-center pb-10 bg-gray-100">
        <Spinner />
        <p className="mt-2 text-sm text-gray-500">{`${t("Đang tạo đơn thanh toán")}...`}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-[60vh] pb-10 bg-gray-100">
      {/* Sticky Toolbar */}
      <div className="sticky top-14 z-40 bg-white shadow-sm">
        <div className="flex items-center gap-4 max-w-screen-xl mx-auto px-6 py-3">
          <div
            onClick={() => router.back()}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-700 no-underline transition-colors hover:text-primary cursor-pointer"
          >
            <HiArrowLeft className="text-base" />
            <span>{t("Quay lại")}</span>
          </div>
          <div className="w-px h-5 bg-gray-300" />
          <div className="flex items-center gap-2">
            <RiSecurePaymentLine className="text-xl text-green-500" />
            <h1 className="text-base font-bold text-gray-800 m-0">{t("Đăng Ký Gói")}</h1>
          </div>
        </div>
        {/* Green accent bar */}
        <div className="h-[3px] bg-gradient-to-r from-green-500 via-green-600 to-green-300" />
      </div>

      <div className="container flex flex-col flex-1 justify-center items-center mx-auto pt-4">
        <div className="flex overflow-hidden flex-col gap-y-4 p-4 w-full max-w-lg bg-white rounded-2xl border border-t-4 border-gray-200 shadow-sm border-t-primary">
          {/* Chọn gói subscription */}
          <div>
            <Label text={t("Chọn gói đăng ký")} />
            {loadingPlans ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {planConfigs.map((config) => {
                  const meta = PLAN_META[config.plan];
                  const isSelected = selectedPlan === config.plan;
                  const isHighlight = meta?.highlight;

                  return (
                    <button
                      key={config.plan}
                      type="button"
                      onClick={() => setSelectedPlan(config.plan)}
                      className={`relative flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        isSelected
                          ? `${meta.borderActive} ${meta.accentBg}`
                          : "border-gray-200 bg-white hover:border-gray-300"
                      }`}
                    >
                      {/* Highlight badge */}
                      {isHighlight && (
                        <span className="absolute -top-2 right-3 px-2 py-0.5 text-[10px] font-bold text-white bg-primary rounded-full">
                          {t(meta.badgeLabel)}
                        </span>
                      )}

                      {/* Radio indicator */}
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          isSelected ? meta.borderActive : "border-gray-400"
                        }`}
                      >
                        {isSelected && (
                          <div
                            className={`w-2.5 h-2.5 rounded-full ${
                              isSelected ? meta.accentBg.replace("/10", "") || "bg-primary" : ""
                            }`}
                            style={{
                              backgroundColor: isSelected ? "currentColor" : undefined,
                            }}
                          />
                        )}
                      </div>

                      {/* Icon */}
                      <div
                        className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center text-lg ${meta.accentBg}`}
                      >
                        {meta.icon}
                      </div>

                      {/* Plan info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              isSelected ? meta.accentColor : "text-gray-800"
                            }`}
                          >
                            {t(meta.label)}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatNumber(config.videoLimit)} video &{" "}
                          {formatNumber(config.imageLimit)} {t("ảnh")} / {t("ngày")}
                        </p>
                      </div>

                      {/* Price */}
                      <div className="flex-shrink-0 text-right">
                        <span className={`text-sm font-bold ${meta.accentColor}`}>
                          {formatPrice(config.price)}
                        </span>
                        {config.price > 0 && (
                          <span className="text-[10px] text-gray-400 block">/{t("tháng")}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chi tiết gói đã chọn */}
          {selectedConfig && (
            <div
              className={`p-3 rounded-xl border ${
                PLAN_META[selectedConfig.plan]?.accentBg || "bg-gray-50"
              } border-gray-200`}
            >
              <h4
                className={`text-sm font-semibold mb-2 ${
                  PLAN_META[selectedConfig.plan]?.accentColor || "text-gray-800"
                }`}
              >
                {t("Chi tiết gói")} {t(PLAN_META[selectedConfig.plan]?.label)}
              </h4>
              <ul className="space-y-1.5">
                <li className="flex items-center gap-2 text-xs text-gray-700">
                  <HiCheck className="text-green-500 flex-shrink-0" />
                  <span>
                    {t("Tạo tối đa")} {formatNumber(selectedConfig.videoLimit)} video / {t("ngày")}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-700">
                  <HiCheck className="text-green-500 flex-shrink-0" />
                  <span>
                    {t("Tạo tối đa")} {formatNumber(selectedConfig.imageLimit)} {t("hình ảnh")} /{" "}
                    {t("ngày")}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-700">
                  <HiCheck className="text-green-500 flex-shrink-0" />
                  <span>
                    {t("Tối đa")} {formatNumber(selectedConfig.videoStreamCount)}{" "}
                    {t("luồng video cùng lúc")}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-700">
                  <HiCheck className="text-green-500 flex-shrink-0" />
                  <span>
                    {t("Tối đa")} {formatNumber(selectedConfig.imageStreamCount)}{" "}
                    {t("luồng tạo ảnh cùng lúc")}
                  </span>
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-700">
                  <HiCheck className="text-green-500 flex-shrink-0" />
                  <span>{t("Không giới hạn câu prompt chuyển động")}</span>
                </li>
              </ul>
            </div>
          )}

          {/* Hiển thị tổng tiền */}
          {selectedConfig && (
            <div className="flex gap-x-2 items-center w-full text-lg font-bold text-right text-red-700">
              <span className="text-sm text-gray-600">{`${t("Tổng thanh toán")}:`}</span>
              <span className="text-lg font-bold text-right text-red-700">
                {parseNumber(selectedConfig.price, true)}
              </span>
            </div>
          )}

          {/* Chọn phương thức thanh toán */}
          <div>
            <Label text={t("Phương thức thanh toán")} />
            <div className="flex flex-col gap-2">
              {PAYMENT_METHOD_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedPaymentType(option.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    selectedPaymentType === option.value
                      ? "border-primary bg-primary/5"
                      : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  {/* Radio indicator */}
                  <div
                    className={`flex-shrink-0 mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      selectedPaymentType === option.value ? "border-primary" : "border-gray-400"
                    }`}
                  >
                    {selectedPaymentType === option.value && (
                      <div className="w-2 h-2 rounded-full bg-primary" />
                    )}
                  </div>
                  {/* Icon và nhãn */}
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-base">{option.icon}</span>
                      <span
                        className={`text-sm font-semibold ${
                          selectedPaymentType === option.value ? "text-primary" : "text-gray-800"
                        }`}
                      >
                        {t(option.label)}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-gray-500">{t(option.description)}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Nút hành động */}
          <div className="pt-1">
            {selectedPaymentType === "SEPAY_PG" && sePayLoading ? (
              // Hiển thị thông báo đang chuyển hướng khi xử lý SePay PG
              <div className="flex gap-2 justify-center items-center py-3 w-full font-semibold text-center rounded-xl bg-primary/10 text-primary">
                <Spinner className="!w-5 !h-5" />
                <span>{t("Đang chuyển đến cổng thanh toán...")}</span>
              </div>
            ) : (
              <Button
                primary
                className="py-3 w-full font-semibold rounded-xl"
                text={
                  <>
                    {t("Thanh toán ngay")}
                    <span className="inline-block ml-1">›</span>
                  </>
                }
                onClick={handleCheckout}
                disabled={isLoading || !selectedPlan}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
