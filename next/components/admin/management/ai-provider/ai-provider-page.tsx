import { useTranslation } from "react-i18next";
import { useToast } from "../../../../lib/providers/toast-provider";
import { AiProvider, AiProviderService } from "../../../../lib/repo/ai-provider/ai-provider.repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { Switch } from "../../../shared/utilities/form/switch";
import { AiProviderFields } from "./components/ai-provider-fields";

export function AiProviderPage() {
  const { t } = useTranslation();
  const toast = useToast();
  return (
    <Card>
      <DataTable<AiProvider>
        crudService={AiProviderService}
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
          <DataTable.Search placeholder={t("Tìm theo tên hoặc mã")} />
          <DataTable.Filter />
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Nhà cung cấp")}
                  width={220}
                  render={(item: AiProvider) => (
                    <DataTable.CellText
                      image={item.imgUrl}
                      imageClassName="w-10 h-10"
                      value={
                        <div className="flex flex-col">
                          <span className="font-semibold">{item.name || "-"}</span>
                          {item.key && (
                            <span className="text-sm text-gray-600">{item.key}</span>
                          )}
                        </div>
                      }
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Website")}
                  render={(item: AiProvider) => (
                    <DataTable.CellText
                      value={
                        item.website ? (
                          <a
                            href={item.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline truncate max-w-[200px] block"
                          >
                            {item.website}
                          </a>
                        ) : (
                          "-"
                        )
                      }
                    />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Trạng thái")}
                  render={(item: AiProvider) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          dependent
                          value={item.active}
                          onChange={async () => {
                            try {
                              const res = await AiProviderService.update({
                                id: item.id,
                                data: { active: !item.active },
                                toast,
                              });
                              changeRowData(item, "active", res.active);
                            } catch (err) {
                              changeRowData(item, "active", item.active);
                            }
                          }}
                        />
                      }
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Ngày tạo")}
                  render={(item: AiProvider) => (
                    <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy HH:mm" />
                  )}
                />
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: AiProvider) => (
                    <>
                      <DataTable.CellButton value={item} isEditButton />
                      <DataTable.CellButton hoverDanger value={item} isDeleteButton />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>

        <DataTable.Form grid width={600} slideFromBottom="none">
          <AiProviderFields />
        </DataTable.Form>

        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
