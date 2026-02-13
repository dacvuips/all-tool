import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../../../lib/hooks/useOptionsTranslate";
import { ShippingProvider } from "../../../../../../lib/repo";
import {
  Shipment,
  shipmentService
} from "../../../../../../lib/repo/list/shipment.repo";
import { Order, PaymentStatus } from "../../../../../../lib/repo/order/order.repo";
import { Button } from "../../../../../shared/utilities/form/button";
import { StatusLabel } from "../../../../../shared/utilities/misc";
import { DataTable } from "../../../../../shared/utilities/table/data-table";
import { OrderSection } from "../order-section";
import { ShipmentLogsDialog } from "./shipment-logs-dialog";
import { ShippingProviderDialog } from "./shipping-provider-dialog";

interface ShippingProvidersTableProps {
  order: Order;
  onSuccess: () => void;
}

/**
 * Component hiển thị danh sách shipments của order
 */
export function ShipmentsTable({ order, onSuccess }: ShippingProvidersTableProps) {
  const { t } = useTranslation();

  const [selectedProvider, setSelectedProvider] = useState<ShippingProvider | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null);
  const [showLogsDialog, setShowLogsDialog] = useState(false);

  const [reloadKey, setReloadKey] = useState(0);
  const {SHIPMENT_STATUS_OPTIONS} = useOptionsTranslation();
  // Hàm format số tiền
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(amount);
  };

  // Hàm format ngày tháng
  const formatDate = (date?: Date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }; 
 
  return (
    <OrderSection title={t("Đơn vận chuyển")} icon="fas fa-box">
      {/* Nút tạo đơn vận chuyển ở ngoài table */}
      <div className="mb-4">
        <Button
          primary
          onClick={() => setShowCreateForm(true)}
          className="rounded-md"
          icon={<i className="mr-2 fas fa-plus" />} text={t("Tạo đơn vận chuyển")}
          disabled={order.paymentStatus !== PaymentStatus.PAYMENT_SUCCESS} 
        />
      
      </div>

      {/* DataTable hiển thị danh sách shipments */}
      <DataTable<Shipment>
        key={reloadKey}
        crudService={shipmentService}
        filter={{ orderId: order.id }}
        order={{ createdAt: -1 }}
        limit={5}
      >
        <DataTable.Table>
          {/* Cột Mã vận đơn */}
          <DataTable.Column
            label={t("Mã vận đơn")}
            width={150}
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {item.trackingCode || "-"}
                    </div>
                    <div className="text-xs text-gray-500">{item.provider}</div>
                  </div>
                }
              />
            )}
          />

          {/* Cột Dịch vụ */}
          <DataTable.Column
            label={t("Dịch vụ")}
            width={100}
            center
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <span className="inline-flex px-2 text-xs font-semibold leading-5 text-blue-800 bg-blue-100 rounded-full">
                    {item.serviceCode}
                  </span>
                }
              />
            )}
          />

          {/* Cột Trạng thái */}
          <DataTable.Column
            label={t("Trạng thái")}
            width={120}
            center
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                   <StatusLabel value={item.status} options={SHIPMENT_STATUS_OPTIONS}/>
                }
              />
            )}
          />

          {/* Cột Phí vận chuyển */}  
          <DataTable.Column
            label={t("Phí vận chuyển")}
            width={120}
            right
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(item.shippingFee)}
                  </span>
                }
              />
            )}
          />
      
          {/* Cột COD */}
          <DataTable.Column
            label={t("Tiền COD")}
            width={120}
            right
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(item.codAmount)}
                  </span>
                }
              />
            )}
          />
 {/* Phí dịch vụ */}
       <DataTable.Column
            label={t("Tổng phí")}
            width={120}
            right
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <span className="text-sm font-medium text-gray-900">
                    {formatCurrency(item.totalFee
 || 0)}
                  </span>
                }
              />
            )}
          />
          {/* Cột Dự kiến giao */}
          <DataTable.Column
            label={t("Dự kiến giao")}
            width={150}
            center
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <span className="text-xs text-gray-700">
                    {formatDate(item.estimatedDeliveryDate)}
                  </span>
                }
              />
            )}
          />

          {/* Cột Thao tác */}
          <DataTable.Column
            label={t("Thao tác")}
            width={100}
            center
            render={(item: Shipment) => (
              <DataTable.CellText
                value={
                  <Button
                    info
                    small
                    onClick={() => {
                      setSelectedShipment(item);
                      setShowLogsDialog(true);
                    }}
                    className="rounded-md whitespace-nowrap"
                    icon={<i className="fas fa-history" />}
                  >
                    {t("Xem logs")}
                  </Button>
                }
              />
            )}
          />
        </DataTable.Table>
        {/* Pagination */}
        <DataTable.Pagination />
      </DataTable>

      {/* Dialog form tạo đơn vận chuyển */}
      <ShippingProviderDialog
        isOpen={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        selectShippingProvider={selectedProvider!}
        order={order}
        onSuccess={() => {
          setShowCreateForm(false);
          onSuccess();
          setReloadKey((prev) => prev + 1); // Trigger reload of DataTable
        }}
      />

      {/* Dialog xem logs của shipment */}
      <ShipmentLogsDialog
        isOpen={showLogsDialog}
        onClose={() => setShowLogsDialog(false)}
        shipment={selectedShipment}
      />
    </OrderSection>
  );
}
