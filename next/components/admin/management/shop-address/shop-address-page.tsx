import { useTranslation } from "react-i18next";
import { HiCheck } from "react-icons/hi";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { ShopAddress, ShopAddressService } from "../../../../lib/repo/list/shopAddress.repo";
import { Button } from "../../../shared/utilities/form";
import { Card } from "../../../shared/utilities/misc";
import { DataTable, useDataTable } from "../../../shared/utilities/table/data-table";
import { ShopAddressFields } from "./components/shop-address-fields";

/**
 * Component quản lý địa chỉ cửa hàng
 * Hiển thị danh sách, thêm mới, sửa, xóa địa chỉ gửi hàng của shop
 */
export const ShopAddressPage = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  return (
    <Card>
      <DataTable<ShopAddress>
        crudService={ShopAddressService}
        order={{ createdAt: -1 }}
        fragment={ShopAddressService.shortFragment}
      >
        <ShopAddressContent />
      </DataTable>
    </Card>
  );
};

/**
 * Component nội dung bên trong DataTable để có thể sử dụng useDataTable hook
 */
const ShopAddressContent = () => {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const { loadAll } = useDataTable();

  /**
   * Xử lý set địa chỉ mặc định
   */
  const handleSetDefault = async (address: ShopAddress) => {
    try {
      await ShopAddressService.setDefault(address.id);
      toast.success(t("Đã set địa chỉ mặc định"));
      // Reload data
      await loadAll(true);
    } catch (error: any) {
      console.error("Set default error:", error);
      toast.error(error.message || t("Có lỗi xảy ra"));
    }
  };

  return (
    <>
      <DataTable.Header>
        <DataTable.Title>{t("Địa chỉ cửa hàng")}</DataTable.Title>
        <DataTable.Buttons>
          <DataTable.Button outline isRefreshButton refreshAfterTask />
          <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_ORDER")} />
        </DataTable.Buttons>
      </DataTable.Header>

      <DataTable.Divider />

      <DataTable.Toolbar>
        <DataTable.Search placeholder={t("Tìm kiếm địa chỉ...")} />
        <DataTable.Filter></DataTable.Filter>
      </DataTable.Toolbar>

      <DataTable.Table className="mt-4">
        <DataTable.Column
          label={t("Tên người liên hệ")}
          render={(item: ShopAddress) => (
            <div className="font-medium">
              {item.recipientName}
              {item.default && (
                <span className="px-2 py-1 ml-2 text-xs text-white rounded bg-primary">
                  {t("Mặc định")}
                </span>
              )}
            </div>
          )}
        />
        <DataTable.Column
          label={t("Số điện thoại")}
          render={(item: ShopAddress) => <div>{item.phone}</div>}
        />
        <DataTable.Column
          label={t("Địa chỉ")}
          render={(item: ShopAddress) => (
            <div className="max-w-md">
              <div className="text-sm">{item.address}</div>
              <div className="text-xs text-gray-500">
                {[item.ward, item.district, item.province].filter(Boolean).join(", ")}
              </div>
            </div>
          )}
        />
        <DataTable.Column
          label={t("Trạng thái")}
          center
          render={(item: ShopAddress) => (
            <div>
              {item.isActive ? (
                <span className="text-success">{t("Hoạt động")}</span>
              ) : (
                <span className="text-danger">{t("Vô hiệu")}</span>
              )}
            </div>
          )}
        />
        <DataTable.Column
          right
          render={(item: ShopAddress) => (
            <div className="flex items-center justify-end gap-2">
              {!item.default && (
                <Button
                  small
                  icon={<HiCheck />}
                  tooltip={t("Set mặc định")}
                  onClick={() => handleSetDefault(item)}
                />
              )}
              <DataTable.CellButton
                value={item}
                isEditButton
                disabled={!userPermission("EDIT_ORDER")}
              />
              <DataTable.CellButton
                hoverDanger
                value={item}
                isDeleteButton
                disabled={!userPermission("DELETE_ORDER")}
              />
            </div>
          )}
        />
      </DataTable.Table>

      <DataTable.Pagination />

      {/* Form tạo/sửa địa chỉ */}
      <DataTable.Form
        grid
        width={800}
        slideFromBottom="none"
        footerProps={{
          submitProps: {
            disabled: !userPermission("EDIT_ORDER"),
          },
        }}
      >
        <ShopAddressFields />
      </DataTable.Form>
    </>
  );
};
