import { useEffect, useState } from "react";

import { Card } from "../../../shared/utilities/misc";
import { DataTable } from "../../../shared/utilities/table/data-table";

import { useTranslation } from "react-i18next";
import { SelectCustomerService } from "../../../../lib/repo/get-all-select-resource/select-customer.repo";
import { SelectUserService } from "../../../../lib/repo/get-all-select-resource/select-user.repo";
import {
  Notification,
  NotificationService,
} from "../../../../lib/repo/notification/notification.repo";
import { DatePicker, Field, Select } from "../../../shared/utilities/form";

export function AllNotificationPage(props) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);

  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
    });
  }, [timeRange]);
  return (
    <Card>
      <DataTable<Notification>
        crudService={NotificationService}
        order={{ createdAt: -1 }}
        filter={filter}
      >
        <DataTable.Header>
          <DataTable.Title />
          <DataTable.Buttons>
            <DataTable.Button outline isRefreshButton refreshAfterTask />
          </DataTable.Buttons>
        </DataTable.Header>

        <DataTable.Divider />

        <DataTable.Toolbar>
          <DataTable.Search style={{ width: "315px" }} />
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
            <Field name="customerId" noError>
              <Select
                className="w-60"
                clearable
                placeholder={t("Lọc theo khách hàng")}
                autocompletePromise={(props) =>
                  SelectCustomerService.getAllAutocompletePromise(props, {
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

            <Field name="userId" noError>
              <Select
                className="w-56"
                clearable
                placeholder={t("Lọc theo nhân viên")}
                autocompletePromise={(props) =>
                  SelectUserService.getAllAutocompletePromise(props, {
                    fragment: "id name avatar",
                    parseOption: (data) => ({
                      value: data.id,
                      label: data.name,
                      image: data.avatar,
                    }),
                  })
                }
                hasImage
              />
            </Field>
          </DataTable.Filter>
        </DataTable.Toolbar>
        <DataTable.Table className="mt-4">
          <DataTable.Column
            label={t("Chủ đề")}
            render={(item: Notification) => (
              <DataTable.CellText
                className="font-semibold whitespace-nowrap"
                value={item.title}
                subText={
                  <DataTable.CellDate
                    className="whitespace-nowrap"
                    value={item.createdAt}
                    format="HH:mm:dd-MM-yyyy"
                  />
                }
              />
            )}
          />
          <DataTable.Column
            label={t("Nội dung")}
            render={(item: Notification) => <DataTable.CellText value={item.body} />}
          />
        </DataTable.Table>
        <DataTable.Pagination />
      </DataTable>
    </Card>
  );
}
