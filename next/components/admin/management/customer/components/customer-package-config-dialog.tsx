import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiPhotograph, HiVideoCamera } from "react-icons/hi";
import { RiStackLine, RiFlowChart } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  Customer,
  CustomerService,
  SubscriptionPlanEnum,
} from "../../../../../lib/repo/customer/customer.repo";
import { SettingService, Setting } from "../../../../../lib/repo/general/setting.repo";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Spinner } from "../../../../shared/utilities/misc";

/** Map from SubscriptionPlanEnum value → lowercase key prefix used in settings */
const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.TRIAL]: "trial",
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.UNLIMITED]: "unlimited",
};

/** Ordered list of plans to display (excluding FREE which has no config) */
const PLAN_ORDER = [
  SubscriptionPlanEnum.TRIAL,
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.UNLIMITED,
];

/** Accent colour per plan for card styling */
const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  [SubscriptionPlanEnum.TRIAL]: {
    bg: "bg-gray-50",
    border: "border-gray-300",
    badge: "bg-gray-500",
  },
  [SubscriptionPlanEnum.BASIC]: {
    bg: "bg-blue-50",
    border: "border-blue-300",
    badge: "bg-blue-500",
  },
  [SubscriptionPlanEnum.STANDARD]: {
    bg: "bg-green-50",
    border: "border-green-300",
    badge: "bg-green-500",
  },
  [SubscriptionPlanEnum.PROFESSIONAL]: {
    bg: "bg-purple-50",
    border: "border-purple-300",
    badge: "bg-purple-500",
  },
  [SubscriptionPlanEnum.UNLIMITED]: {
    bg: "bg-yellow-50",
    border: "border-yellow-300",
    badge: "bg-yellow-600",
  },
};

interface PlanConfig {
  plan: SubscriptionPlanEnum;
  videoLimit: number;
  imageLimit: number;
  imageStreamCount: number;
  videoStreamCount: number;
  price: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer;
  loadAll?: (refresh?: boolean) => void;
}

export function CustomerPackageConfigDialog({ isOpen, onClose, customer, loadAll }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([]);

  // Fetch settings with "pk-" prefix when the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);

    // Fetch all settings, then filter by "pk-" key prefix
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
        console.error(err);
        toast.error(t("Không thể tải cấu hình gói"));
      })
      .finally(() => setLoading(false));
  }, [isOpen]);

  const handleSelectPlan = async (config: PlanConfig) => {
    if (!userPermission("EDIT_CUSTOMER")) return;
    setSaving(true);
    try {
      await CustomerService.update({
        id: customer.id,
        data: {
          subscription: config.plan,
          videoLimit: config.videoLimit,
          imageLimit: config.imageLimit,
          imageStreamCount: config.imageStreamCount,
          videoStreamCount: config.videoStreamCount,
        },
      });
      toast.success(t("Cập nhật gói thành công"));
      loadAll?.(true);
      onClose();
    } catch (err) {
      toast.error(`${t("Cập nhật gói thất bại")}: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));
  const formatPrice = (n: number) =>
    n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + " đ";

  const isCurrentPlan = (plan: SubscriptionPlanEnum) => customer?.subscription === plan;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Cấu hình gói đăng ký")}
      width="900px"
      slideFromBottom="none"
    >
      <div className="p-5">
        {/* Current plan info */}
        <div className="flex items-center gap-2 mb-4 text-sm text-gray-600">
          <RiStackLine className="text-lg" />
          <span>
            {t("Gói hiện tại")}:{" "}
            <strong className="text-primary">{customer?.subscription || "Free"}</strong>
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {planConfigs.map((config) => {
              const colors = PLAN_COLORS[config.plan];
              const isCurrent = isCurrentPlan(config.plan);

              return (
                <div
                  key={config.plan}
                  className={`relative flex flex-col rounded-xl border-2 p-4 transition-all ${
                    isCurrent
                      ? `${colors.border} ${colors.bg} ring-2 ring-primary ring-offset-1`
                      : `border-gray-200 hover:${colors.border} hover:shadow-md`
                  }`}
                >
                  {/* Plan badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-xs font-bold text-white ${colors.badge}`}
                    >
                      {config.plan}
                    </span>
                    {isCurrent && (
                      <span className="flex items-center gap-1 text-xs font-semibold text-primary">
                        <HiCheck className="text-sm" /> {t("Đang dùng")}
                      </span>
                    )}
                  </div>

                  {/* Price */}
                  <div className="mb-3 text-lg font-bold text-gray-800">
                    {formatPrice(config.price)}
                  </div>

                  {/* Limits */}
                  <div className="flex-1 space-y-2 text-sm text-gray-600">
                    <div className="flex items-center gap-2">
                      <HiVideoCamera className="text-base text-blue-500" />
                      <span>
                        {t("Video")}: <strong>{formatNumber(config.videoLimit)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <HiPhotograph className="text-base text-green-500" />
                      <span>
                        {t("Ảnh")}: <strong>{formatNumber(config.imageLimit)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiFlowChart className="text-base text-purple-500" />
                      <span>
                        {t("Luồng video")}:{" "}
                        <strong>{formatNumber(config.videoStreamCount)}</strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <RiFlowChart className="text-base text-orange-500" />
                      <span>
                        {t("Luồng ảnh")}:{" "}
                        <strong>{formatNumber(config.imageStreamCount)}</strong>
                      </span>
                    </div>
                  </div>

                  {/* Select button */}
                  <button
                    className={`mt-4 w-full rounded-lg py-2 text-sm font-semibold transition-colors ${
                      isCurrent
                        ? "cursor-default bg-gray-200 text-gray-500"
                        : `${colors.badge} text-white hover:opacity-90`
                    }`}
                    disabled={isCurrent || saving || !userPermission("EDIT_CUSTOMER")}
                    onClick={() => handleSelectPlan(config)}
                  >
                    {saving ? t("Đang lưu...") : isCurrent ? t("Đang dùng") : t("Chọn gói")}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Dialog>
  );
}
