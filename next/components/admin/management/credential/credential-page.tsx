import { useTranslation } from "react-i18next";
import { formatDate } from "../../../../lib/helpers/parser";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Credential, credentialService } from "../../../../lib/repo";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { CredentialFields } from "./components/credential-fields";

export function CredentialPage() {
  const { t } = useTranslation();
  const { userPermission } = useAuth();
  const toast = useToast();
  const { CREDENTIAL_KEY_OPTIONS } = useOptionsTranslation();
  return (
    <Card>
      <DataTable<Credential> crudService={credentialService} order={{ createdAt: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton disabled={!userPermission("EDIT_CREDENTIAL")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar></DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label={t("Key")}
                  width={220}
                  render={(item: Credential) => (
                    <div>
                      <div className="flex gap-2 justify-start items-center">
                        <DataTable.CellText
                          image={
                            CREDENTIAL_KEY_OPTIONS.find((option) => option.value === item.key)
                              ?.image || ""
                          }
                          value={item.key?.replace(/_/g, " ") || "-"}
                          className="font-medium"
                        />
                      </div>

                      <div className="text-sm text-gray-500">
                        {t("Ngày tạo")}:{" "}
                        {item.createdAt ? formatDate(item.createdAt, "dd/MM/yyyy HH:mm") : "-"}
                      </div>
                    </div>
                  )}
                />

                <DataTable.Column
                  right
                  className="whitespace-nowrap"
                  render={(item: Credential) => (
                    <div className="flex gap-2 justify-end items-center">
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
                    </div>
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
