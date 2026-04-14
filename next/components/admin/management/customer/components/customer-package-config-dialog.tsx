import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiCheck, HiPencil, HiPhotograph, HiSave, HiVideoCamera } from "react-icons/hi";
import { RiFlowChart, RiStackLine } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import {
  Customer,
  CustomerService,
  GooglePackage,
  SubscriptionPlanEnum,
} from "../../../../../lib/repo/customer/customer.repo";
import { Setting, SettingService } from "../../../../../lib/repo/general/setting.repo";
import { AlertDialog } from "../../../../shared/utilities/dialog/alert-dialog";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Spinner } from "../../../../shared/utilities/misc";
import { TabGroup } from "../../../../shared/utilities/tab/tab-group";

/** Map from SubscriptionPlanEnum value → lowercase key prefix used in settings */
const PLAN_KEY_MAP: Record<string, string> = {
  [SubscriptionPlanEnum.FREE]: "free",
  [SubscriptionPlanEnum.TRIAL]: "trial",
  [SubscriptionPlanEnum.BASIC]: "basic",
  [SubscriptionPlanEnum.STANDARD]: "standard",
  [SubscriptionPlanEnum.PROFESSIONAL]: "professional",
  [SubscriptionPlanEnum.UNLIMITED]: "unlimited",
};

/** Ordered list of plans to display */
const PLAN_ORDER = [
  SubscriptionPlanEnum.FREE,
  SubscriptionPlanEnum.TRIAL,
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.UNLIMITED,
];

/** Accent colour per plan for card styling */
const PLAN_COLORS: Record<string, { bg: string; border: string; badge: string }> = {
  [SubscriptionPlanEnum.FREE]: {
    bg: "bg-slate-50",
    border: "border-gray-300",
    badge: "bg-gray-400",
  },
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

/** Fields in googlePackage that can be edited individually */
const EDITABLE_FIELDS: {
  key: keyof GooglePackage;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
  type: "number" | "datetime";
}[] = [
  {
    key: "videoLimit",
    label: "Giới hạn video",
    icon: <HiVideoCamera className="text-base" />,
    iconColor: "text-blue-500",
    type: "number",
  },
  {
    key: "imageLimit",
    label: "Giới hạn ảnh",
    icon: <HiPhotograph className="text-base" />,
    iconColor: "text-green-500",
    type: "number",
  },
  {
    key: "videoCount",
    label: "Video đã dùng",
    icon: <HiVideoCamera className="text-base" />,
    iconColor: "text-blue-400",
    type: "number",
  },
  {
    key: "imageCount",
    label: "Ảnh đã dùng",
    icon: <HiPhotograph className="text-base" />,
    iconColor: "text-green-400",
    type: "number",
  },
  {
    key: "videoStreamCount",
    label: "Luồng video đồng thời",
    icon: <RiFlowChart className="text-base" />,
    iconColor: "text-purple-500",
    type: "number",
  },
  {
    key: "imageStreamCount",
    label: "Luồng ảnh đồng thời",
    icon: <RiFlowChart className="text-base" />,
    iconColor: "text-orange-500",
    type: "number",
  },
  {
    key: "expiryPackageDate",
    label: "Ngày hết hạn gói",
    icon: <RiStackLine className="text-base" />,
    iconColor: "text-red-500",
    type: "datetime",
  },
];

export function CustomerPackageConfigDialog({ isOpen, onClose, customer, loadAll }: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([]);
  const [confirmConfig, setConfirmConfig] = useState<PlanConfig | null>(null);

  // State for field update tab
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({});
  const [editingField, setEditingField] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<string | null>(null);

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

  // Initialize field values from customer's googlePackage
  useEffect(() => {
    if (!isOpen || !customer?.googlePackage) return;
    const pkg = customer.googlePackage;
    setFieldValues({
      videoLimit: pkg.videoLimit ?? 0,
      imageLimit: pkg.imageLimit ?? 0,
      videoCount: pkg.videoCount ?? 0,
      imageCount: pkg.imageCount ?? 0,
      videoStreamCount: pkg.videoStreamCount ?? 0,
      imageStreamCount: pkg.imageStreamCount ?? 0,
      expiryPackageDate: pkg.expiryPackageDate
        ? new Date(pkg.expiryPackageDate).toISOString().slice(0, 16)
        : "",
    });
    setEditingField(null);
  }, [isOpen, customer]);

  const handleSelectPlan = async (config: PlanConfig) => {
    if (!userPermission("EDIT_CUSTOMER")) return;
    setSaving(true);
    try {
      await CustomerService.customerUpdatePackage({
        customerId: customer.id,
        subscription: config.plan,
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

  const handleSaveField = async (fieldKey: string) => {
    if (!userPermission("EDIT_CUSTOMER")) return;
    const value = fieldValues[fieldKey];
    if (value === undefined || value === null || value === "") return;

    setSavingField(fieldKey);
    try {
      const fieldData: Record<string, any> = {};
      if (fieldKey === "expiryPackageDate") {
        fieldData[fieldKey] = new Date(value).toISOString();
      } else {
        fieldData[fieldKey] = Number(value);
      }

      await CustomerService.customerUpdatePackageField({
        customerId: customer.id,
        fieldData,
      });
      toast.success(t(`Cập nhật ${fieldKey} thành công`));
      setEditingField(null);
      loadAll?.(true);
    } catch (err) {
      toast.error(`${t("Cập nhật thất bại")}: ${err.message}`);
    } finally {
      setSavingField(null);
    }
  };

  const formatNumber = (n: number) => (n === -1 ? "∞" : n.toLocaleString("vi-VN"));
  const formatPrice = (n: number) => (n === 0 ? t("Miễn phí") : n.toLocaleString("vi-VN") + " đ");

  const isCurrentPlan = (plan: SubscriptionPlanEnum) =>
    customer?.googlePackage?.subscription === plan;

  const formatFieldDisplay = (field: typeof EDITABLE_FIELDS[0], value: any) => {
    if (value === undefined || value === null || value === "") return "N/A";
    if (field.type === "datetime") {
      return value ? new Date(value).toLocaleString("vi-VN") : "N/A";
    }
    return value === -1 ? "∞" : Number(value).toLocaleString("vi-VN");
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={onClose}
        title={t("Cấu hình gói đăng ký")}
        width="900px"
        slideFromBottom="none"
      >
        <div className="p-2">
          {/* Current plan info */}
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <RiStackLine className="text-lg" />
            <span>
              {t("Gói hiện tại")}:{" "}
              <strong className="text-primary">
                {customer?.googlePackage?.subscription || "Free"}
              </strong>
            </span>
          </div>

          <TabGroup
            tabClassName="py-3 px-4"
            activeClassName="text-primary"
            hasInkBar
            bodyClassName=""
            flex={false}
          >
            {/* Tab 1: Chọn gói */}
            <TabGroup.Tab label={t("Cập nhật toàn bộ")}>
              {loading ? (
                <div className="flex justify-center py-12">
                  <Spinner />
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-4">
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
                          onClick={() => setConfirmConfig(config)}
                        >
                          {saving ? t("Đang lưu...") : isCurrent ? t("Đang dùng") : t("Chọn gói")}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabGroup.Tab>

            {/* Tab 2: Cập nhật từng field */}
            <TabGroup.Tab label={t("Cập nhật từng phần")}>
              <div className="mt-4 space-y-3">
                {EDITABLE_FIELDS.map((field) => {
                  const isEditing = editingField === field.key;
                  const isSaving = savingField === field.key;

                  return (
                    <div
                      key={field.key}
                      className={`flex items-center gap-3 rounded-lg border p-3 transition-all ${
                        isEditing
                          ? "border-primary bg-blue-50 shadow-sm"
                          : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                      }`}
                    >
                      {/* Icon */}
                      <div className={`flex-shrink-0 ${field.iconColor}`}>{field.icon}</div>

                      {/* Label */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-700">{t(field.label)}</div>
                        {!isEditing && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {formatFieldDisplay(field, fieldValues[field.key])}
                          </div>
                        )}
                      </div>

                      {/* Input / Display */}
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <input
                            type={field.type === "datetime" ? "datetime-local" : "number"}
                            className="w-40 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                            value={fieldValues[field.key] ?? ""}
                            onChange={(e) =>
                              setFieldValues((prev) => ({
                                ...prev,
                                [field.key]: e.target.value,
                              }))
                            }
                            disabled={isSaving}
                            autoFocus
                          />
                          <button
                            className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                            onClick={() => handleSaveField(field.key)}
                            disabled={isSaving || !userPermission("EDIT_CUSTOMER")}
                          >
                            {isSaving ? (
                              <Spinner className="w-4 h-4" />
                            ) : (
                              <HiSave className="text-sm" />
                            )}
                            {t("Lưu")}
                          </button>
                          <button
                            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
                            onClick={() => {
                              setEditingField(null);
                              // Reset to original value
                              const pkg = customer.googlePackage || {};
                              if (field.type === "datetime") {
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.key]: pkg[field.key]
                                    ? new Date(pkg[field.key] as any).toISOString().slice(0, 16)
                                    : "",
                                }));
                              } else {
                                setFieldValues((prev) => ({
                                  ...prev,
                                  [field.key]: pkg[field.key] ?? 0,
                                }));
                              }
                            }}
                            disabled={isSaving}
                          >
                            {t("Huỷ")}
                          </button>
                        </div>
                      ) : (
                        <button
                          className="flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 hover:border-primary hover:text-primary transition-colors"
                          onClick={() => setEditingField(field.key)}
                          disabled={!userPermission("EDIT_CUSTOMER")}
                        >
                          <HiPencil className="text-sm" />
                          {t("Sửa")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </TabGroup.Tab>
          </TabGroup>
        </div>
      </Dialog>

      {/* Confirm alert */}
      <AlertDialog
        isOpen={!!confirmConfig}
        type="question"
        title={t("Xác nhận chọn gói")}
        content={t(`Bạn có chắc muốn chuyển sang gói "${confirmConfig?.plan}"?`)}
        confirm={t("Xác nhận")}
        cancel={t("Huỷ")}
        onConfirm={async () => {
          if (confirmConfig) {
            await handleSelectPlan(confirmConfig);
          }
          setConfirmConfig(null);
        }}
        onClose={() => setConfirmConfig(null)}
      />
    </>
  );
}
