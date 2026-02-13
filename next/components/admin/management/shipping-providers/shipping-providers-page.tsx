import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  ShippingProvider,
  ShippingProviderService,
} from "../../../../lib/repo/list/shippingProvider.repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";

import { Switch } from "../../../shared/utilities/form/switch";
import { ShippingProviderFields } from "./components/shipping-provider-fields";

/**
 * Component chính hiển thị danh sách nhà cung cấp vận chuyển
 * Cho phép CRUD và quản lý trạng thái các nhà cung cấp
 */
export function ShippingProvidersPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});

  return (
    <Card>
      <DataTable<ShippingProvider>
        crudService={ShippingProviderService}
        filter={filter}
        order={{ priority: -1, createdAt: -1 }}
      >
        {/* Header với tiêu đề và các nút action */}
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            {/* Nút làm mới danh sách */}
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            {/* Nút thêm mới - chỉ hiển thị nếu có quyền */}
            <DataTable.Button
              primary
              isAddButton
              disabled={!userPermission("CREATE_SHIPPING_PROVIDER")}
            />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        {/* Thanh công cụ tìm kiếm và lọc */}
        <DataTable.Toolbar>
          <DataTable.Search placeholder={t("Tìm theo tên hoặc mã nhà cung cấp")} />
          <DataTable.Filter>{/* Có thể thêm các bộ lọc khác ở đây nếu cần */}</DataTable.Filter>
        </DataTable.Toolbar>

        {/* Consumer để truy cập các hàm xử lý dữ liệu */}
        <DataTable.Consumer>
          {({ changeRowData, loadAll }) => (
            <>
              {/* Bảng dữ liệu chính */}
              <DataTable.Table className="mt-4">
                {/* Cột Logo và Tên */}
                <DataTable.Column
                  label={t("Nhà cung cấp")}
                  width={250}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellText
                      image={item.logo}
                      imageClassName="w-12 h-12"
                      value={
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.name}</span>
                          <span className="text-sm text-gray-600">{item.code}</span>
                        </div>
                      }
                    />
                  )}
                />

                {/* Cột Cấu hình API */}
                <DataTable.Column
                  label={t("Cấu hình API")}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellText
                      value={
                        <div className="flex flex-col text-sm">
                          <span className="text-gray-600">
                            {t("URL")}: {item.apiConfig?.baseUrl || "-"}
                          </span>
                          {item.apiConfig?.shopId && (
                            <span className="text-gray-600">
                              {t("Shop ID")}: {item.apiConfig.shopId}
                            </span>
                          )}
                        </div>
                      }
                    />
                  )}
                />

                {/* Cột Số lượng dịch vụ */}
                <DataTable.Column
                  center
                  label={t("Dịch vụ")}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellText
                      value={
                        <div className="flex flex-col items-center">
                          <span className="font-semibold text-primary">
                            {item.services?.length || 0}
                          </span>
                          <span className="text-xs text-gray-500">{t("dịch vụ")}</span>
                        </div>
                      }
                    />
                  )}
                />

                {/* Cột Độ ưu tiên */}
                <DataTable.Column
                  center
                  label={t("Ưu tiên")}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellText value={item.priority || 0} />
                  )}
                />

                {/* Cột Trạng thái */}
                <DataTable.Column
                  center
                  label={t("Trạng thái")}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          readOnly={!userPermission("EDIT_SHIPPING_PROVIDER")}
                          dependent
                          value={item.isActive}
                          onChange={async () => {
                            try {
                              const res = await ShippingProviderService.update({
                                id: item.id,
                                data: { isActive: !item.isActive },
                              });
                              changeRowData(item, "isActive", res.isActive);
                              toast.success(t("Cập nhật trạng thái thành công"));
                            } catch (err) {
                              changeRowData(item, "isActive", item.isActive);
                              toast.error(t("Cập nhật trạng thái thất bại"));
                            }
                          }}
                        />
                      }
                    />
                  )}
                />

                {/* Cột Ngày tạo */}
                <DataTable.Column
                  label={t("Ngày tạo")}
                  render={(item: ShippingProvider) => (
                    <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy HH:mm" />
                  )}
                />

                {/* Cột Actions */}
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: ShippingProvider) => (
                    <>
                      {/* Nút sửa */}
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_SHIPPING_PROVIDER")}
                      />
                      {/* Nút xóa */}
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                        disabled={!userPermission("DELETE_SHIPPING_PROVIDER")}
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>

        {/* Form tạo/sửa nhà cung cấp */}
        <DataTable.Form
          grid
          width={800}
          slideFromBottom="none"
          footerProps={{
            submitProps: {
              disabled: !userPermission("EDIT_SHIPPING_PROVIDER"),
            },
          }}
        >
          <ShippingProviderFields />
        </DataTable.Form>

        {/* Phân trang */}
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
