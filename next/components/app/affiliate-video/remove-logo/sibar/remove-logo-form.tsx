/**
 * Form sidebar Xóa Logo AI
 */
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { RiCloseLine, RiMagicLine } from "react-icons/ri";
import { useAuth } from "../../../../../lib/providers/auth-provider";
import { useToast } from "../../../../../lib/providers/toast-provider";
import { SubscriptionPlanEnum } from "../../../../../lib/repo/customer/customer.repo";
import { Button } from "../../../../shared/utilities/form";
import { GenerateAiIcon } from "../../../../../public/assets/svg/generate-ai";
import {
  REMOVE_LOGO_IMAGE_MAX_MB,
  REMOVE_LOGO_VIDEO_MAX_MB,
} from "../constants";
import { useProcessRemoveLogoFile } from "../hook/useProcessRemoveLogoFile";
import { useRemoveLogoContext } from "../providers/remove-logo-provider";
import { RemoveLogoUpload } from "./remove-logo-upload";

const PAID_PLANS = new Set([
  SubscriptionPlanEnum.BASIC,
  SubscriptionPlanEnum.STANDARD,
  SubscriptionPlanEnum.PROFESSIONAL,
  SubscriptionPlanEnum.ENTERPRISE,
]);

function isPaidPlan(subscription?: string | null) {
  return !!subscription && PAID_PLANS.has(subscription as SubscriptionPlanEnum);
}

export function RemoveLogoForm({ onClose }: { onClose?: () => void }) {
  const { t } = useTranslation();
  const toast = useToast();
  const { customer } = useAuth();
  const { processOneFile } = useProcessRemoveLogoFile();
  const { uploads, setUploads, running, setRunning } = useRemoveLogoContext();

  const pkg = customer?.googlePackage;
  const canUse = isPaidPlan(pkg?.subscription);

  const imageRemaining = Math.max(0, (pkg?.imageLimit ?? 0) - (pkg?.imageCount ?? 0));
  const videoRemaining = Math.max(0, (pkg?.videoLimit ?? 0) - (pkg?.videoCount ?? 0));
  const unlimitedImage = (pkg?.imageLimit ?? 0) < 0;
  const unlimitedVideo = (pkg?.videoLimit ?? 0) < 0;

  /** Tạo lại 1 file đã xong — gọi API ngay, đẩy lịch sử ngay */
  const handleRetry = useCallback(
    async (id: string) => {
      if (running) {
        toast.warn(t("Đang xử lý, vui lòng đợi..."));
        return;
      }
      const item = uploads.find((u) => u.id === id);
      if (!item || item.status !== "done") return;
      if (!customer) {
        toast.error(t("Vui lòng đăng nhập để sử dụng"));
        return;
      }
      if (!canUse) {
        toast.error(
          t("Chức năng Xóa Logo AI chỉ dành cho gói Basic trở lên. Vui lòng nâng cấp gói.")
        );
        return;
      }

      setRunning(true);
      try {
        const result = await processOneFile(item, { silentSuccess: false });
        if (result === "ok") {
          // đã toast trong processOneFile
        }
      } finally {
        setRunning(false);
      }
    },
    [running, uploads, customer, canUse, processOneFile, setRunning, toast, t]
  );

  const handleSubmit = useCallback(async () => {
    const ready = uploads.filter(
      (u) => u.status === "ready" || u.status === "error" || u.status === "skipped"
    );
    if (!ready.length) {
      toast.error(t("Vui lòng upload ít nhất 1 ảnh hoặc video"));
      return;
    }
    if (!customer) {
      toast.error(t("Vui lòng đăng nhập để sử dụng"));
      return;
    }
    if (!canUse) {
      toast.error(
        t("Chức năng Xóa Logo AI chỉ dành cho gói Basic trở lên. Vui lòng nâng cấp gói.")
      );
      return;
    }

    setRunning(true);
    let successCount = 0;
    let failCount = 0;
    let stoppedByQuota = false;

    try {
      for (const u of ready) {
        if (stoppedByQuota) {
          setUploads((prev) =>
            prev.map((item) =>
              item.id === u.id
                ? {
                    ...item,
                    status: "skipped" as const,
                    errorMessage: t(
                      "Hết hạn mức. Vui lòng nâng cấp gói hoặc chờ reset ngày mai."
                    ),
                  }
                : item
            )
          );
          failCount += 1;
          continue;
        }

        const result = await processOneFile(u, {
          silentSuccess: ready.length > 1,
        });
        if (result === "ok") {
          successCount += 1;
        } else if (result === "quota") {
          stoppedByQuota = true;
          failCount += 1;
          // đánh dấu các file còn lại trong queue
        } else {
          failCount += 1;
        }
      }

      if (ready.length > 1) {
        if (successCount > 0 && failCount === 0) {
          toast.success(t("Hoàn tất {{count}} file", { count: successCount }));
        } else if (successCount > 0 && failCount > 0) {
          toast.info(
            t("Xong {{ok}} file · {{fail}} file lỗi/bỏ qua", {
              ok: successCount,
              fail: failCount,
            })
          );
        } else if (successCount === 0) {
          toast.error(t("Không xử lý được file nào"));
        }
      } else if (successCount === 0 && failCount > 0) {
        // lỗi đã toast trong processOneFile
      }
    } finally {
      setRunning(false);
    }
  }, [
    uploads,
    customer,
    canUse,
    processOneFile,
    setRunning,
    setUploads,
    toast,
    t,
  ]);

  return (
    <div className="flex flex-col h-full bg-white">
      <div className="flex flex-shrink-0 justify-between items-center px-4 pt-4 pb-3 border-b border-gray-100">
        <div className="flex gap-2 items-center">
          <div className="flex justify-center items-center w-8 h-8 rounded-full bg-primary">
            <RiMagicLine className="text-base text-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-base font-bold text-gray-800">{t("Xóa Logo AI")}</span>
            <span className="text-xs text-gray-500">
              {t("Xóa watermark / logo trên ảnh & video (Basic+)")}
            </span>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex justify-center items-center w-8 h-8 bg-gray-100 rounded-full border-0 transition-colors cursor-pointer md:hidden hover:bg-gray-200"
          >
            <RiCloseLine className="text-lg text-gray-600" />
          </button>
        )}
      </div>

      <div className="overflow-y-auto flex-1 min-h-0 v-scrollbar">
        <div className="px-4 pt-3">
          {!canUse ? (
            <div className="p-3 text-xs text-amber-800 bg-amber-50 rounded-xl border border-amber-100">
              {t(
                "Tính năng này chỉ dành cho gói Basic trở lên. Gói Free và Trial không sử dụng được."
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 bg-slate-50 rounded-xl border border-gray-100">
                <p className="text-slate-400">{t("Hạn mức ảnh")}</p>
                <p className="font-semibold text-slate-700">
                  {unlimitedImage
                    ? t("Không giới hạn")
                    : `${imageRemaining} / ${pkg?.imageLimit ?? 0}`}
                </p>
              </div>
              <div className="p-2 bg-slate-50 rounded-xl border border-gray-100">
                <p className="text-slate-400">{t("Hạn mức video")}</p>
                <p className="font-semibold text-slate-700">
                  {unlimitedVideo
                    ? t("Không giới hạn")
                    : `${videoRemaining} / ${pkg?.videoLimit ?? 0}`}
                </p>
              </div>
            </div>
          )}
        </div>

        <RemoveLogoUpload onRetry={handleRetry} />

        <div className="px-4 pb-3 text-xs leading-relaxed text-slate-400">
          <p>
            ·{" "}
            {t("Ảnh tối đa {{n}}MB · Video tối đa {{m}}MB", {
              n: REMOVE_LOGO_IMAGE_MAX_MB,
              m: REMOVE_LOGO_VIDEO_MAX_MB,
            })}
          </p>
          <p>· {t("Xử lý từng file — xong đâu hiện lịch sử ngay")}</p>
          <p>· {t('Nút "Tạo lại" chạy lại ngay 1 file đã xong')}</p>
        </div>
      </div>

      <div className="flex-shrink-0 px-4 pt-2 pb-4 bg-white border-t border-gray-100">
        <Button
          className="w-full"
          primary
          disabled={running || !uploads.length || !customer}
          isLoading={running}
          text={running ? t("Đang xóa logo...") : t("Xóa Logo AI")}
          icon={<GenerateAiIcon />}
          onClick={handleSubmit}
        />
      </div>
    </div>
  );
}
