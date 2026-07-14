import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { Order, orderService } from "../../../../lib/repo";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";
import { Card, StatusLabel } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { OrderDetailForm } from "./components/order-detail-form";

const ORDER_TYPE_LABELS: Record<string, string> = {
  TOOL: "Tool",
  RECAPTCHA: "Recaptcha",
  API_MEDIA: "API Media",
  NORMAL: "Thường",
};

export function OrderPage() {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS, PAYMENT_METHOD_OPTIONS } =
    useOptionsTranslation();

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

  return (
    <Card>
      <DataTable<Order> crudService={orderService} filter={filter} order={{ createdAt: -1 }}>
        <DataTable.Header>
          <DataTable.Title>{t("Danh sách đơn hàng")}</DataTable.Title>
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search placeholder={t("Tìm mã đơn hàng...")} />
          <DataTable.Filter>
            <Field noError>
              <DatePicker
                className="w-40"
                value={timeRange}
                onChange={setTimeRange}
                selectsRange
                fullHeader
                placeholder={t("Lọc thời gian")}
                clearable
              />
            </Field>
            <Field name="type" noError>
              <Select
                className="w-40"
                clearable
                placeholder={t("Lọc loại đơn")}
                options={Object.entries(ORDER_TYPE_LABELS).map(([value, label]) => ({
                  value,
                  label: t(label),
                }))}
              />
            </Field>
            <Field name="status" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc trạng thái đơn")}
                options={ORDER_STATUS_OPTIONS}
              />
            </Field>
            <Field name="paymentStatus" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc trạng thái thanh toán")}
                options={PAYMENT_STATUS_OPTIONS}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {() => (
            <DataTable.Table className="mt-4">
              <DataTable.Column
                label={t("Mã đơn")}
                width={150}
                render={(item: Order) => (
                  <div className="space-y-0.5">
                    <DataTable.CellText value={item.orderNumber} className="font-semibold" />
                    <DataTable.CellDate
                      value={item.createdAt}
                      format="dd/MM/yyyy HH:mm"
                      className="text-xs text-gray-500"
                    />
                  </div>
                )}
              />

              <DataTable.Column
                label={t("Khách hàng")}
                render={(item: Order) => {
                  const email = item.customer?.email;
                  const name = item.customer?.name;
                  const label = email || name || item.customerId || "-";
                  return (
                    <DataTable.CellText
                      value={
                        item.customerId ? (
                          <div className="min-w-0 max-w-[220px]">
                            <Link
                              href={`/admin/management/customers?id=${item.customerId}`}
                              className="font-medium text-primary hover:underline break-all"
                            >
                              {label}
                            </Link>
                            {email && name ? (
                              <div className="text-xs text-gray-500 truncate" title={name}>
                                {name}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )
                      }
                    />
                  );
                }}
              />

              <DataTable.Column
                label={t("Loại / Gói")}
                render={(item: Order) => (
                  <div className="space-y-0.5">
                    <DataTable.CellText
                      value={
                        item.type
                          ? t(ORDER_TYPE_LABELS[item.type] || item.type)
                          : "-"
                      }
                      className="font-medium"
                    />
                    <DataTable.CellText
                      value={item.subscriptionPlan || "-"}
                      className="text-xs text-gray-500 capitalize"
                    />
                  </div>
                )}
              />

              <DataTable.Column
                label={t("Thanh toán")}
                center
                render={(item: Order) => {
                  const methodLabel =
                    PAYMENT_METHOD_OPTIONS.find(
                      (o) => o.value === (item.paymentInfo?.method || item.paymentMethod)
                    )?.label ||
                    item.paymentInfo?.method ||
                    item.paymentMethod ||
                    "-";
                  return (
                    <div className="flex flex-col gap-1 items-center">
                      <span className="text-xs text-gray-600">{methodLabel}</span>
                      <StatusLabel
                        extraClassName="rounded-md"
                        options={PAYMENT_STATUS_OPTIONS}
                        value={item.paymentStatus}
                      />
                    </div>
                  );
                }}
              />

              <DataTable.Column
                label={t("Trạng thái")}
                center
                render={(item: Order) => (
                  <StatusLabel
                    extraClassName="rounded-md"
                    options={ORDER_STATUS_OPTIONS}
                    value={item.status}
                    type="border-light"
                  />
                )}
              />

              <DataTable.Column
                label={t("Tổng tiền")}
                right
                orderBy="totalAmount"
                render={(item: Order) => (
                  <DataTable.CellText
                    className="font-semibold text-primary whitespace-nowrap"
                    value={
                      item.totalAmount != null
                        ? `${Number(item.totalAmount).toLocaleString("vi-VN")}đ`
                        : "-"
                    }
                  />
                )}
              />

              <DataTable.Column
                right
                className="whitespace-nowrap"
                render={(item: Order) => (
                  <DataTable.CellButton
                    value={item}
                    isEditButton
                    disabled={!userPermission("EDIT_ORDER")}
                  />
                )}
              />
            </DataTable.Table>
          )}
        </DataTable.Consumer>

        <DataTable.Form width="95vw" maxWidth={1200} slideFromBottom="none" hasFooter={false}>
          <OrderDetailForm />
        </DataTable.Form>

        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
