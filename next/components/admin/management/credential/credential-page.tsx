import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Credential, credentialService } from "../../../../lib/repo";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { Switch } from "../../../shared/utilities/form/switch";
import { CredentialFields } from "./components/credential-fields";

export function CredentialPage() {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const toast = useToast();

  return (
    <Card>
      <DataTable<Credential>
        crudService={credentialService}
        order={{ createdAt: -1 }}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button
              primary
              isAddButton
              disabled={!userPermission("EDIT_CREDENTIAL")}
            />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search placeholder={t("Tìm theo key")} />
          <DataTable.Filter />
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Key")}
                  width={220}
                  render={(item: Credential) => (
                    <DataTable.CellText
                      value={item.key?.replace(/_/g, " ") || "-"}
                      className="font-medium"
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Giá trị")}
                  render={(item: Credential) => (
                    <DataTable.CellText
                      value={item.value ? "••••••••" : "-"}
                      className="text-gray-600"
                    />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Kích hoạt")}
                  render={(item: Credential) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          dependent
                          value={item.active}
                          onChange={async () => {
                            try {
                              const res = await credentialService.update({
                                id: item.id,
                                data: { active: !item.active },
                                toast,
                              });
                              changeRowData(item, "active", res.active);
                            } catch {
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
                  render={(item: Credential) => (
                    <DataTable.CellDate
                      value={item.createdAt}
                      format="dd/MM/yyyy HH:mm"
                    />
                  )}
                />
                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: Credential) => (
                    <>
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_CREDENTIAL")}
                      />
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                        disabled={!userPermission("EDIT_CREDENTIAL")}
                      />
                    </>
                  )}
                />
              </DataTable.Table>
            </>
          )}
        </DataTable.Consumer>

        <DataTable.Form grid width={600} slideFromBottom="none">
          <CredentialFields />
        </DataTable.Form>

        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
