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

export function OrderPage() {
  const { t } = useTranslation();
 
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const { ORDER_STATUS_OPTIONS, PAYMENT_STATUS_OPTIONS } = useOptionsTranslation();
  

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

 

  const coverAddress = (order: Order) => {
    return`${order?.shippingAddress?.address}
              ${order?.shippingAddress?.ward && `, ${order.shippingAddress.ward}`}
              ${order?.shippingAddress?.district && `, ${order.shippingAddress.district}`}
              ${order?.shippingAddress?.province && `, ${order.shippingAddress.province}`}`;
    
     
  } 

  return (
    <Card>
      <DataTable<Order> crudService={orderService} filter={filter} order={{ createdAt: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
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
          {({ loadAll }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Mã đơn")}
                  width={140}
                  render={(item: Order) => (
                   <> <DataTable.CellText value={item.orderNumber} className="font-semibold" />
                   <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy HH:mm" /></>
                  )}
                />

                <DataTable.Column
                  label={t("Khách hàng")}
                  render={(item: Order)  => (
                    <DataTable.CellText
                      value={
                        <div>
                          {item.customerId ? (
                            <Link
                              href={`/admin/management/customers?id=${item.customerId}`}
                              className="font-medium text-primary hover:underline"
                            >
                              {item.shippingAddress?.recipientName}
                            </Link>
                          ) : (
                            <div className="font-medium">{item.shippingAddress?.recipientName}</div>
                          )}
                          <div className="text-sm text-gray-600">{item.shippingAddress?.phone}</div>
                        </div>
                      }
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Địa chỉ giao")}
                  render={(item: Order) => (
                    <DataTable.CellText
                      value={
                        coverAddress(item)
                      }
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Trạng thái")}
                  center
                  render={(item: Order) => (
                    <DataTable.CellText
                      value={
                        
                          <StatusLabel  extraClassName="rounded-md" options={ORDER_STATUS_OPTIONS} value={item.status} type="border-light" />
                          
                           
                        
                      }
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Trạng thái thanh toán ")}
                  center
                  render={(item: Order) => (
                    <DataTable.CellText
                      value={
                        
                          
                          <StatusLabel extraClassName="rounded-md"
                            options={PAYMENT_STATUS_OPTIONS}
                            value={item.paymentStatus}
                             
                          />
                         
                      }
                    />
                  )}
                />


                <DataTable.Column
                  label={t("Tổng tiền")}
                  right
                  render={(item: Order) => (
                    <DataTable.CellText
                      className="font-semibold text-primary"
                      value={`${item.totalAmount?.toLocaleString()}đ`}
                    />
                  )}
                />

                

                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: Order) => (
                    <>
                       
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_ORDER")}
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
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
