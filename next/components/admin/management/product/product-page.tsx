import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";

import { useTranslation } from "react-i18next";
import { RiSettings4Line } from "react-icons/ri";

import { Product, ProductService } from "../../../../lib/repo/product";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ProductField } from "./components/product-field";
import { ProductFlowPage } from "./product-flow-page";

export function ProductPage(props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);

  const [showFlowView, setShowFlowView] = useState(false);
  const [flowProductId, setFlowProductId] = useState<string | null>(null);

  const handleOpenProductFlow = (productId: string) => {
    setFlowProductId(productId);
    setShowFlowView(true);
  };

  if (showFlowView) {
    return (
      <ProductFlowPage
        initialProductId={flowProductId}
        onBack={() => {
          setShowFlowView(false);
          setFlowProductId(null);
        }}
      />
    );
  }

  return (
    <Card>
      <DataTable<Product> crudService={ProductService} filter={filter} order={{ priority: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_PRODUCT")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            {/* <Field noError>
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
            <Field name="isPublic" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc trạng thái")}
                options={OTHER_INFO_STATUS}
              />
            </Field> */}
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData, loadAll }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label="Ảnh bìa"
                  width={120}
                  render={(item: Product) => (
                    <DataTable.CellText
                      ratio169
                      imageClassName="w-28"
                      compress={200}
                      image={item.coverImg}
                      value=""
                    />
                  )}
                />

                <DataTable.Column
                  label={t("Tiêu đề")}
                  render={(item: Product) => <DataTable.CellText value={item.name} />}
                />

                <DataTable.Column
                  label={t("Ngày đăng")}
                  render={(item: Product) => (
                    <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy" />
                  )}
                />
                <DataTable.Column
                  right
                  label={t("Kích hoạt")}
                  render={(item: Product) => (
                    <DataTable.CellText
                      className="flex justify-end"
                      value={
                        <Switch
                          readOnly={!userPermission("EDIT_PRODUCT")}
                          dependent
                          value={item.active}
                          onChange={async () => {
                            try {
                              const res = await ProductService.toggleActive(item.id);
                              changeRowData(item, "active", res.active);
                              toast.success(t("Cập trạng thái thành công"));
                            } catch (err) {
                              changeRowData(item, "active", item.active);
                              toast.error(t("Cập trạng thái thất bại"));
                            }
                          }}
                        />
                      }
                    />
                  )}
                />
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: Product) => (
                    <>
                      <DataTable.CellButton
                        icon={<RiSettings4Line />}
                        value={item}
                        disabled={!userPermission("EDIT_PRODUCT")}
                        tooltip={t("Cấu hình sản phẩm")}
                        onClick={() => handleOpenProductFlow(item.id)}
                      />
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_PRODUCT")}
                      />
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                        disabled={!userPermission("DELETE_PRODUCT")}
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>
        <DataTable.Form grid width={1024} slideFromBottom="none">
          <ProductField />
        </DataTable.Form>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
