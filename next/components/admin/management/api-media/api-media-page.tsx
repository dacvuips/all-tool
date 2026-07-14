import Link from "next/link";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import {
  ApiMediaSubscriptionPlanEnum,
  ApiMediaToken,
  apiMediaTokenService,
} from "../../../../lib/repo/api-media-token/api-media-token.repo";
import { CustomerService } from "../../../../lib/repo/customer/customer.repo";
import { Field, Select } from "../../../shared/utilities/form";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { ApiMediaFields } from "./components/api-media-fields";

const PLAN_LABELS: Record<string, string> = {
  [ApiMediaSubscriptionPlanEnum.FREE]: "Free",
  [ApiMediaSubscriptionPlanEnum.BASIC]: "Basic",
  [ApiMediaSubscriptionPlanEnum.STANDARD]: "Standard",
  [ApiMediaSubscriptionPlanEnum.PROFESSIONAL]: "Professional",
  [ApiMediaSubscriptionPlanEnum.UNLIMITED]: "Unlimited",
};

export function ApiMediaAdminPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();

  return (
    <Card>
      <DataTable<ApiMediaToken> crudService={apiMediaTokenService} order={{ createdAt: -1 }}>
        <DataTable.Header>
          <DataTable.Title>{t("API Media")}</DataTable.Title>
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_API_MEDIA")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search placeholder={t("Tìm theo email khách hàng")} />
          <DataTable.Filter>
            <Field name="customerId" noError>
              <Select
                className="w-60"
                clearable
                placeholder={t("Lọc theo khách hàng")}
                autocompletePromise={(props) =>
                  CustomerService.getAllAutocompletePromise(props, {
                    fragment: "id name avatarUrl",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatarUrl,
                    }),
                  })
                }
                hasImage
              />
            </Field>
            <Field name="subscriptionPlan" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc theo gói")}
                options={Object.entries(PLAN_LABELS).map(([value, label]) => ({
                  value,
                  label,
                }))}
              />
            </Field>
            <Field name="active" noError>
              <Switch placeholder={t("Lọc kích hoạt")} />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData }) => (
            <DataTable.Table className="mt-4">
              <DataTable.Column
                label={t("API Key")}
                width={180}
                render={(item: ApiMediaToken) => (
                  <DataTable.CellText
                    value={item.keyPrefix || item.key || "-"}
                    className="font-mono text-sm"
                  />
                )}
              />
              <DataTable.Column
                label={t("Khách hàng")}
                render={(item: ApiMediaToken) =>
                  item.customerId ? (
                    <DataTable.CellText
                      value={
                        <Link
                          href={`/admin/management/customers?id=${item.customerId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {item.customer?.email || item.customerId}
                        </Link>
                      }
                    />
                  ) : (
                    <DataTable.CellText value="-" />
                  )
                }
              />
              <DataTable.Column
                label={t("Gói")}
                render={(item: ApiMediaToken) => (
                  <DataTable.CellText
                    value={
                      item.subscriptionPlan
                        ? PLAN_LABELS[item.subscriptionPlan] || item.subscriptionPlan
                        : "-"
                    }
                  />
                )}
              />
              <DataTable.Column
                center
                label={t("Đã dùng")}
                orderBy="usedQuantity"
                render={(item: ApiMediaToken) => (
                  <DataTable.CellNumber value={item.usedQuantity ?? 0} />
                )}
              />
              <DataTable.Column
                center
                label={t("Quota")}
                orderBy="requestQuantity"
                render={(item: ApiMediaToken) => (
                  <DataTable.CellNumber value={item.requestQuantity ?? 0} />
                )}
              />
              <DataTable.Column
                center
                label={t("Luồng")}
                render={(item: ApiMediaToken) => (
                  <DataTable.CellText
                    value={
                      item.streamCount === -1 ? t("Không giới hạn") : String(item.streamCount ?? 0)
                    }
                  />
                )}
              />
              <DataTable.Column
                label={t("Hết hạn")}
                render={(item: ApiMediaToken) => (
                  <DataTable.CellDate value={item.expiredDate} format="dd/MM/yyyy" />
                )}
              />
              <DataTable.Column
                center
                label={t("Kích hoạt")}
                render={(item: ApiMediaToken) => (
                  <DataTable.CellText
                    className="flex justify-center"
                    value={
                      <Switch
                        dependent
                        readOnly={!userPermission("EDIT_API_MEDIA")}
                        value={item.active}
                        onChange={async () => {
                          try {
                            const res = await apiMediaTokenService.update({
                              id: item.id,
                              data: { active: !item.active },
                            });
                            changeRowData(item, "active", res.active);
                            toast.success(t("Cập nhật trạng thái thành công"));
                          } catch {
                            changeRowData(item, "active", item.active);
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
                render={(item: ApiMediaToken) => (
                  <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy" />
                )}
              />
              <DataTable.Column
                right
                className="whitespace-nowrap"
                render={(item: ApiMediaToken) => (
                  <>
                    <DataTable.CellButton
                      value={item}
                      isEditButton
                      disabled={!userPermission("EDIT_API_MEDIA")}
                    />
                    <DataTable.CellButton
                      hoverDanger
                      value={item}
                      isDeleteButton
                      disabled={!userPermission("DELETE_API_MEDIA")}
                    />
                  </>
                )}
              />
            </DataTable.Table>
          )}
        </DataTable.Consumer>

        <DataTable.Form grid width={650} slideFromBottom="none">
          <ApiMediaFields />
        </DataTable.Form>

        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
