import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  ObjectToPersonify,
  ObjectToPersonifyService,
} from "../../../../lib/repo/list/objectToPersonify.repo";

import { Field } from "../../../shared/utilities/form";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ObjectToPersonifyFields } from "./components/object-to-personify-fields";

export function ObjectToPersonifyPage() {
  const { t } = useTranslation();
  const toast = useToast();

  return (
    <Card>
      <DataTable<ObjectToPersonify>
        crudService={ObjectToPersonifyService}
        order={{ createdAt: -1 }}
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
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Ảnh")}
                  width={100}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText
                      imageClassName="w-16"
                      compress={100}
                      image={item.imageUrl}
                      value=""
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Tên nhân vật")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText
                      value={item.name}
                      className="font-semibold"
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Mã code")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText value={item.code} />
                  )}
                />
                <DataTable.Column
                  label={t("Prompt")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText
                      value={item.prompt}
                      className="max-w-xs truncate"
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Customer ID")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText value={item.customerId} />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Kích hoạt")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          dependent
                          value={item.isActive}
                          onChange={async () => {
                            try {
                              const res =
                                await ObjectToPersonifyService.update({
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
                  label={t("Ngày tạo")}
                  render={(item: ObjectToPersonify) => (
                    <DataTable.CellDate
                      value={item.createdAt}
                      format="dd/MM/yyyy"
                    />
                  )}
                />
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: ObjectToPersonify) => (
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
          <ObjectToPersonifyFields />
        </DataTable.Form>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
