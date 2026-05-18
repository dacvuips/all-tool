import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  ArtStyleCategory,
  ArtStyleCategoryService,
} from "../../../../lib/repo/list/artStyleCategory.repo";

import { Field } from "../../../shared/utilities/form";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ArtStyleCategoryFields } from "./components/art-style-category-fields";

export function ArtStyleCategoryPage() {
  const { t } = useTranslation();
  const toast = useToast();

  return (
    <Card>
      <DataTable<ArtStyleCategory>
        crudService={ArtStyleCategoryService}
        order={{ priority: -1, createdAt: -1 }}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter>
            <Field name="isActive" noError>
              <Switch placeholder={t("Lọc kích hoạt")} />
            </Field>
            <Field name="isHot" noError>
              <Switch placeholder={t("Lọc HOT")} />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Tên danh mục")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellText
                      value={item.name}
                      className="font-semibold"
                    />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Ưu tiên")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellNumber value={item.priority} />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("HOT")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          dependent
                          value={item.isHot}
                          onChange={async () => {
                            try {
                              const res = await ArtStyleCategoryService.update({
                                id: item.id,
                                data: { isHot: !item.isHot },
                              });
                              changeRowData(item, "isHot", res.isHot);
                              toast.success(t("Cập nhật trạng thái thành công"));
                            } catch (err) {
                              changeRowData(item, "isHot", item.isHot);
                              toast.error(t("Cập nhật trạng thái thất bại"));
                            }
                          }}
                        />
                      }
                    />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Kích hoạt")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          dependent
                          value={item.isActive}
                          onChange={async () => {
                            try {
                              const res = await ArtStyleCategoryService.update({
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
                <DataTable.Column
                  center
                  label={t("Số art style")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellNumber value={item.artStyleIds?.length || 0} />
                  )}
                />
                <DataTable.Column
                  label={t("Ngày tạo")}
                  render={(item: ArtStyleCategory) => (
                    <DataTable.CellDate
                      value={item.createdAt}
                      format="dd/MM/yyyy"
                    />
                  )}
                />
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: ArtStyleCategory) => (
                    <>
                      <DataTable.CellButton value={item} isEditButton />
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>
        <DataTable.Form
          grid
          width={650}
          slideFromBottom="none"
        >
          <ArtStyleCategoryFields />
        </DataTable.Form>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
