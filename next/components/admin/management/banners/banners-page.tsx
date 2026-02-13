import { useEffect, useState } from "react";
import { useAuth } from "../../../../lib/providers/auth-provider";
import { useToast } from "../../../../lib/providers/toast-provider";
import { Banner, BannerService } from "../../../../lib/repo/list/banner.repo";

import { useTranslation } from "react-i18next";
import { useOptionsTranslation } from "../../../../lib/hooks/useOptionsTranslate";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";
import { Switch } from "../../../shared/utilities/form/switch";
import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";
import { BannerFields } from "./components/banner-fields";

export function BannersPage(props) {
  const { t } = useTranslation();
  const toast = useToast();
  const { userPermission } = useAuth();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);

  const { BOOLEAN_OPTION, BANNER_ACTIONS } = useOptionsTranslation();

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);
  return (
    <Card>
      <DataTable<Banner> crudService={BannerService} filter={filter} order={{ priority: -1 }}>
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
            <DataTable.Button primary isAddButton disabled={!userPermission("CREATE_BANNER")} />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search />
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
            <Field name="isPublic" noError>
              <Select
                className="w-48"
                clearable
                placeholder={t("Lọc trạng thái")}
                options={BOOLEAN_OPTION}
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>

        <DataTable.Consumer>
          {({ changeRowData, loadAll }) => (
            <>
              <DataTable.Table className="mt-4">
                <DataTable.Column
                  label="Banner"
                  width={180}
                  render={(item: Banner) => (
                    <DataTable.CellText
                      ratio169
                      imageClassName="w-40"
                      compress={200}
                      image={item.image}
                      value=""
                    />
                  )}
                />
                <DataTable.Column
                  label={t("Hành động")}
                  render={(item: Banner) => (
                    <DataTable.CellText
                      value={
                        <div className="flex flex-col items-start font-semibold gap-y-1">
                          <span
                            className={`status-label bg-${
                              BANNER_ACTIONS.find((x) => x.value == item.actionType)?.color
                            }`}
                          >
                            {BANNER_ACTIONS.find((x) => x.value == item.actionType)?.label}
                          </span>

                          {item.actionType == "NORMAL" && (
                            <>
                              <div>{t("Không có")}</div>
                            </>
                          )}

                          {item.actionType == "WEBSITE" && (
                            <>
                              <div>{item.link}</div>
                            </>
                          )}
                        </div>
                      }
                    />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Ưu tiên")}
                  render={(item: Banner) => <DataTable.CellText value={item.priority} />}
                />
                <DataTable.Column
                  center
                  label={t("Vị trí")}
                  render={(item: Banner) => <DataTable.CellText value={item.position} />}
                />
                <DataTable.Column
                  label={t("Ngày đăng")}
                  render={(item: Banner) => (
                    <DataTable.CellDate value={item.createdAt} format="dd/MM/yyyy" />
                  )}
                />
                <DataTable.Column
                  center
                  label={t("Kích hoạt")}
                  render={(item: Banner) => (
                    <DataTable.CellText
                      className="flex justify-center"
                      value={
                        <Switch
                          readOnly={!userPermission("EDIT_BANNER")}
                          dependent
                          value={item.isPublic}
                          onChange={async () => {
                            try {
                              const res = await BannerService.update({
                                id: item.id,
                                data: { isPublic: !item.isPublic },
                              });
                              changeRowData(item, "isPublic", res.isPublic);
                              toast.success(t("Cập trạng thái thành công"));
                            } catch (err) {
                              changeRowData(item, "isPublic", item.isPublic);
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
                  render={(item: Banner) => (
                    <>
                      <DataTable.CellButton
                        value={item}
                        isEditButton
                        disabled={!userPermission("EDIT_BANNER")}
                      />
                      <DataTable.CellButton
                        hoverDanger
                        value={item}
                        isDeleteButton
                        disabled={!userPermission("DELETE_BANNER")}
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
          footerProps={{
            submitProps: { disabled: !userPermission("EDIT_BANNER") },
          }}
        >
          <BannerFields />
        </DataTable.Form>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
