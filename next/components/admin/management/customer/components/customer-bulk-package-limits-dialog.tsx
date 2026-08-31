import { useState } from "react";
import { useTranslation } from "react-i18next";
import { HiPhotograph, HiVideoCamera } from "react-icons/hi";
import { RiFlowChart, RiMicLine, RiStackLine } from "react-icons/ri";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { Customer, CustomerService } from "../../../../../lib/repo/customer/customer.repo";
import { AlertDialog } from "../../../../shared/utilities/dialog/alert-dialog";
import { Dialog } from "../../../../shared/utilities/dialog/dialog";
import { Spinner } from "../../../../shared/utilities/misc";

interface LimitDeltaField {
  key: string;
  label: string;
  icon: React.ReactNode;
  iconColor: string;
}

const LIMIT_DELTA_FIELDS: LimitDeltaField[] = [
  {
    key: "videoLimitDelta",
    label: "Giới hạn video",
    icon: <HiVideoCamera className="text-base" />,
    iconColor: "text-blue-500",
  },
  {
    key: "imageLimitDelta",
    label: "Giới hạn ảnh",
    icon: <HiPhotograph className="text-base" />,
    iconColor: "text-green-500",
  },
  {
    key: "requestLimitDelta",
    label: "Giới hạn generation text",
    icon: <RiStackLine className="text-base" />,
    iconColor: "text-pink-500",
  },
  {
    key: "textCreditLimitDelta",
    label: "Giới hạn Voice Credit",
    icon: <RiMicLine className="text-base" />,
    iconColor: "text-rose-500",
  },
  {
    key: "videoStreamCountDelta",
    label: "Luồng video đồng thời",
    icon: <RiFlowChart className="text-base" />,
    iconColor: "text-purple-500",
  },
  {
    key: "imageStreamCountDelta",
    label: "Luồng ảnh đồng thời",
    icon: <RiFlowChart className="text-base" />,
    iconColor: "text-orange-500",
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedCustomers: Partial<Customer>[];
  currentFilter: Record<string, any>;
  onSuccess?: () => void;
}

type DeltaValues = Record<string, string>;

const emptyDeltas = (): DeltaValues =>
  Object.fromEntries(LIMIT_DELTA_FIELDS.map((f) => [f.key, ""]));

export function CustomerBulkPackageLimitsDialog({
  isOpen,
  onClose,
  selectedCustomers,
  currentFilter,
  onSuccess,
}: Props) {
  const { t } = useTranslation();
  const toast = useToast();
  const [deltas, setDeltas] = useState<DeltaValues>(emptyDeltas);
  const [applyToFilter, setApplyToFilter] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const selectedCount = selectedCustomers.length;
  const hasFilter = Object.keys(currentFilter || {}).length > 0;
  const canApply = applyToFilter || selectedCount > 0;

  const buildInput = (resetToPackageDefaults: boolean) => {
    const input: Record<string, any> = {
      resetToPackageDefaults,
    };

    if (applyToFilter) {
      input.applyToFilter = true;
      input.filter = currentFilter;
    } else {
      input.customerIds = selectedCustomers.map((c) => c.id);
    }

    if (!resetToPackageDefaults) {
      for (const field of LIMIT_DELTA_FIELDS) {
        const raw = deltas[field.key]?.trim();
        if (raw !== "" && raw !== undefined) {
          input[field.key] = Number(raw);
        }
      }
    }

    return input;
  };

  const hasAnyDelta = LIMIT_DELTA_FIELDS.some((f) => {
    const raw = deltas[f.key]?.trim();
    return raw !== "" && raw !== undefined && !Number.isNaN(Number(raw)) && Number(raw) !== 0;
  });

  const handleApplyDeltas = async () => {
    if (!canApply) {
      toast.error(t("Vui lòng chọn khách hàng hoặc bật áp dụng theo bộ lọc"));
      return;
    }
    if (!hasAnyDelta) {
      toast.error(t("Vui lòng nhập ít nhất một giá trị cộng/trừ"));
      return;
    }

    setSaving(true);
    try {
      const result = await CustomerService.customerBulkUpdatePackageLimits(buildInput(false));
      toast.success(
        t("Đã xử lý {{processed}} KH, cập nhật {{updated}}, {{errors}} lỗi", {
          processed: result.processedCount,
          updated: result.updatedCount,
          errors: result.errorCount,
        })
      );
      setDeltas(emptyDeltas());
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || t("Cập nhật limit hàng loạt thất bại"));
    } finally {
      setSaving(false);
    }
  };

  const handleResetToDefaults = async () => {
    if (!canApply) {
      toast.error(t("Vui lòng chọn khách hàng hoặc bật áp dụng theo bộ lọc"));
      return;
    }

    setSaving(true);
    try {
      const result = await CustomerService.customerBulkUpdatePackageLimits(buildInput(true));
      toast.success(
        t("Đã reset limit {{updated}}/{{processed}} KH về mặc định gói, {{errors}} lỗi", {
          processed: result.processedCount,
          updated: result.updatedCount,
          errors: result.errorCount,
        })
      );
      onSuccess?.();
      onClose();
    } catch (error: any) {
      toast.error(error?.message || t("Reset limit hàng loạt thất bại"));
    } finally {
      setSaving(false);
      setConfirmReset(false);
    }
  };

  const handleClose = () => {
    if (saving) return;
    setDeltas(emptyDeltas());
    setApplyToFilter(false);
    onClose();
  };

  return (
    <>
      <Dialog
        isOpen={isOpen}
        onClose={handleClose}
        title={t("Cập nhật limit gói hàng loạt")}
        width="640px"
        slideFromBottom="none"
      >
        <div className="space-y-5 p-1">
          {/* Target */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">{t("Đối tượng áp dụng")}</div>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="radio"
                name="target"
                checked={!applyToFilter}
                onChange={() => setApplyToFilter(false)}
                disabled={saving}
              />
              {t("Khách hàng đã chọn")}:{" "}
              <strong className={selectedCount > 0 ? "text-primary" : "text-red-500"}>
                {selectedCount}
              </strong>
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-600">
              <input
                type="radio"
                name="target"
                checked={applyToFilter}
                onChange={() => setApplyToFilter(true)}
                disabled={saving}
              />
              {hasFilter
                ? t("Tất cả KH theo bộ lọc hiện tại")
                : t("Tất cả khách hàng")}
            </label>
          </div>

          {/* Delta fields */}
          <div className="space-y-3">
            <div className="text-sm text-gray-500">
              {t("Nhập số dương để cộng thêm, số âm để bớt. Để trống = không thay đổi.")}
            </div>
            {LIMIT_DELTA_FIELDS.map((field) => (
              <div
                key={field.key}
                className="flex items-center gap-3 rounded-lg border border-gray-200 p-3"
              >
                <div className={`flex-shrink-0 ${field.iconColor}`}>{field.icon}</div>
                <div className="flex-1 text-sm font-medium text-gray-700">{t(field.label)}</div>
                <input
                  type="number"
                  className="w-32 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary disabled:bg-gray-100"
                  placeholder="+/-"
                  value={deltas[field.key]}
                  onChange={(e) =>
                    setDeltas((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  disabled={saving}
                />
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
            <button
              type="button"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              onClick={handleClose}
              disabled={saving}
            >
              {t("Huỷ")}
            </button>
            <button
              type="button"
              className="rounded-lg border border-amber-400 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
              onClick={() => setConfirmReset(true)}
              disabled={saving || !canApply}
            >
              {t("Reset limit về mặc định gói")}
            </button>
            <button
              type="button"
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              onClick={handleApplyDeltas}
              disabled={saving || !canApply || !hasAnyDelta}
            >
              {saving && <Spinner className="h-4 w-4" />}
              {t("Cập nhật limit")}
            </button>
          </div>
        </div>
      </Dialog>

      <AlertDialog
        isOpen={confirmReset}
        type="warn"
        title={t("Reset limit về mặc định gói")}
        content={t(
          "Mỗi khách hàng sẽ được reset limit (video, ảnh, text, voice, luồng) về đúng setting của gói hiện tại (Free → Free, Basic → Basic, ...). Không thay đổi số đã dùng và gói đăng ký. Tiếp tục?"
        )}
        confirm={t("Xác nhận")}
        cancel={t("Huỷ")}
        onConfirm={handleResetToDefaults}
        onClose={() => setConfirmReset(false)}
      />
    </>
  );
}
