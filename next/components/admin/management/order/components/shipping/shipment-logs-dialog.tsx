import { useTranslation } from "react-i18next";
import { HiCheckCircle, HiClock, HiExclamation, HiTruck, HiX } from "react-icons/hi";
import { Shipment, ShipmentLog } from "../../../../../../lib/repo/list/shipment.repo";
import { Dialog } from "../../../../../shared/utilities/dialog/dialog";
import { StatusLabel } from "../../../../../shared/utilities/misc/status-label";

interface ShipmentLogsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shipment: Shipment | null;
}

/**
 * Dialog hiển thị logs của shipment
 */
export function ShipmentLogsDialog({ isOpen, onClose, shipment }: ShipmentLogsDialogProps) {
  const { t } = useTranslation();

  if (!shipment) return null;

  // Hàm format ngày tháng
  const formatDateTime = (date: Date) => {
    return new Date(date).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Hàm lấy icon cho status
  const getStatusIcon = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("delivered") || statusLower.includes("giao")) {
      return HiCheckCircle;
    }
    if (statusLower.includes("picked") || statusLower.includes("lấy")) {
      return HiClock;
    }
    if (statusLower.includes("shipping") || statusLower.includes("chuyển")) {
      return HiTruck;
    }
    if (statusLower.includes("returned") || statusLower.includes("hoàn")) {
      return HiExclamation;
    }
    if (
      statusLower.includes("cancelled") ||
      statusLower.includes("hủy") ||
      statusLower.includes("failed")
    ) {
      return HiX;
    }
    return HiCheckCircle;
  };

  // Hàm lấy màu cho status
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower.includes("delivered") || statusLower.includes("giao")) {
      return "bg-green-500";
    }
    if (statusLower.includes("picked") || statusLower.includes("lấy")) {
      return "bg-blue-500";
    }
    if (statusLower.includes("shipping") || statusLower.includes("chuyển")) {
      return "bg-yellow-500";
    }
    if (statusLower.includes("returned") || statusLower.includes("hoàn")) {
      return "bg-orange-500";
    }
    if (
      statusLower.includes("cancelled") ||
      statusLower.includes("hủy") ||
      statusLower.includes("failed")
    ) {
      return "bg-red-500";
    }
    return "bg-green-500";
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={t("Lịch sử vận chuyển")}
      width="800px"
      slideFromBottom="none"
    >
      <div className="p-6">
        {/* Thông tin shipment */}
        <div className="p-4 mb-6 border border-gray-200 rounded-lg bg-gray-50">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-sm text-gray-600">{t("Nhà cung cấp")}:</span>
              <span className="ml-2 text-sm font-medium text-gray-900">{shipment.provider}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">{t("Dịch vụ")}:</span>
              <span className="ml-2 text-sm font-medium text-gray-900">{shipment.serviceCode}</span>
            </div>
            <div>
              <span className="text-sm text-gray-600">{t("Trạng thái hiện tại")}:</span>
              <StatusLabel value={shipment.status} label={shipment.status} extraClassName="ml-2" />
            </div>
            <div>
              <span className="text-sm text-gray-600">{t("Phí vận chuyển")}:</span>
              <span className="ml-2 text-sm font-medium text-gray-900">
                {new Intl.NumberFormat("vi-VN", {
                  style: "currency",
                  currency: "VND",
                }).format(shipment.shippingFee)}
              </span>
            </div>
          </div>
          {shipment.note && (
            <div className="pt-3 mt-3 border-t border-gray-300">
              <span className="text-sm text-gray-600">{t("Ghi chú")}:</span>
              <p className="mt-1 text-sm text-gray-900">{shipment.note}</p>
            </div>
          )}
        </div>

        {/* Timeline logs */}
        <div className="space-y-4">
          <h3 className="mb-4 text-base font-semibold text-gray-900">
            {t("Lịch sử di chuyển")} ({shipment.logs?.length || 0} {t("sự kiện")})
          </h3>

          {!shipment.logs || shipment.logs.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              <i className="mb-2 text-4xl fas fa-inbox"></i>
              <p>{t("Chưa có lịch sử di chuyển")}</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-96">
              <div className="relative pl-6">
                {/* Vertical Line */}
                <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-300"></div>

                {/* Timeline Nodes */}
                <div className="space-y-4">
                  {shipment.logs.map((log: ShipmentLog, index: number) => {
                    const Icon = getStatusIcon(log.status);
                    const isLastNode = index === 0;
                    const isCancelledNode =
                      log.status.toLowerCase().includes("cancelled") ||
                      log.status.toLowerCase().includes("hủy") ||
                      log.status.toLowerCase().includes("failed");
                    const colorClass = getStatusColor(log.status);

                    return (
                      <div key={index} className="relative flex items-start">
                        {/* Icon Circle */}
                        <div
                          className={`absolute left-0 flex items-center justify-center w-8 h-8 rounded-full -ml-6 ${
                            isLastNode ? `${colorClass} ring-4 ring-opacity-30` : colorClass
                          } ${isLastNode && !isCancelledNode ? "ring-green-200" : ""} ${
                            isLastNode && isCancelledNode ? "ring-red-200" : ""
                          }`}
                        >
                          <Icon className="w-4 h-4 text-white" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pb-2 ml-4">
                          <div
                            className={`text-xs font-semibold mb-1 ${
                              isCancelledNode ? "text-red-600" : "text-gray-900"
                            }`}
                          >
                            {log.status}
                          </div>
                          <div className="mb-1 text-xs text-gray-500">
                            {new Date(log.createdAt).toLocaleString("vi-VN", {
                              day: "2-digit",
                              month: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                          {log.description && (
                            <div className="mt-1 text-xs italic text-gray-600">
                              {t("Mô tả")}: {log.description}
                            </div>
                          )}
                          {log.note && (
                            <div className="mt-1 text-xs italic text-gray-600">
                              {t("Ghi chú")}: {log.note}
                            </div>
                          )}
                          {log.location && (
                            <div className="mt-1 text-xs text-gray-600">
                              <i className="mr-1 fas fa-map-marker-alt"></i>
                              {log.location}
                            </div>
                          )}

                          {/* Metadata nếu có */}
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="pt-2 mt-2 border-t border-gray-200">
                              <details className="group">
                                <summary className="text-xs font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                                  <i className="mr-1 fas fa-info-circle"></i>
                                  {t("Chi tiết metadata")}
                                  <i className="ml-1 transition-transform fas fa-chevron-down group-open:rotate-180"></i>
                                </summary>
                                <pre className="p-2 mt-2 overflow-x-auto text-xs bg-gray-100 rounded">
                                  {JSON.stringify(log.metadata, null, 2)}
                                </pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-4 mt-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            {t("Đóng")}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
