import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { User } from "../../../../../lib/repo";
import { AnalyticService } from "../../../../../lib/repo/analytic/analytic.repo";
import { GameOrderStatusEnum } from "../../../../../lib/repo/types";
import { DatePicker, Select } from "../../../../shared/utilities/form";
import { Card } from "../../../../shared/utilities/misc";
import { DataTable } from "../../../../shared/utilities/table/data-table";

import { endOfMonth, startOfMonth } from "date-fns";
import { useOptionsTranslation } from "../../../../../lib/hooks/useOptionsTranslate";
import { SelectUserService } from "../../../../../lib/repo/get-all-select-resource/select-user.repo";
import { TabGroup } from "../../../../shared/utilities/tab";

export function ReportTransactionAllUser() {
  const { t } = useTranslation();
  return (
    <>
      <Card className="col-span-6">
        <TabGroup
          flex={false}
          activeClassName="text-primary"
          hasArrow
          bodyClassName="py-2 mb-10"
          tabClassName="p-2  "
          className="bg-white "
        >
          <TabGroup.Tab label={t("Giao dịch")}>
            <TopTransactionUsers />
          </TabGroup.Tab>
        </TabGroup>
      </Card>
    </>
  );
}

export function TopTransactionUsers({ month }: { month?: string }) {
  const { t } = useTranslation();

  const [topUser, setTopUser] = useState<any[]>();
  const [staffId, setStaffId] = useState();
  const [valueDate, setValueDate] = useState<{ startDate: Date; endDate: Date }>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });
  const [gameOrderStatus, setGameOrderStatus] = useState<string>(GameOrderStatusEnum.COMPLETED);

  const { GAME_ORDER_STATUS_OPTION } = useOptionsTranslation();

  useEffect(() => {
    GetTopUser();
  }, [valueDate, gameOrderStatus, staffId]);

  const GetTopUser = async () =>
    await AnalyticService.getTopTransactionAllUser(
      staffId,
      gameOrderStatus as GameOrderStatusEnum,
      valueDate?.startDate,
      valueDate?.endDate
    ).then((res) => {
      setTopUser(res);
    });

  return (
    <>
      <div className="flex flex-row justify-between my-2">
        <div>
          <div className="font-semibold">{t("Báo cáo giao dịch")}</div>
          <span className="text-sm font-normal text-gray-500 ">
            {t("Danh sách báo cáo giao dịch tài khoản")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="mt-2 w-72">
            <DatePicker
              selectsRange
              fullHeader
              className="rounded-sx"
              value={valueDate}
              onChange={setValueDate}
              placeholder={t("Theo ngày")}
            />
          </div>
          <div className="mt-2 w-36">
            <Select
              autosize
              options={GAME_ORDER_STATUS_OPTION}
              value={gameOrderStatus}
              onChange={(value) => {
                setGameOrderStatus(value);
              }}
            />
          </div>

          <div className="w-48 mt-2">
            <Select
              clearable
              hasImage
              placeholder={t("Tìm nhân viên")}
              optionsPromise={() =>
                SelectUserService.getAllOptionsPromise({
                  fragment: "id name avatar",
                  parseOption: (data) => ({
                    value: data.id,
                    label: data.name,
                    image: data.avatar,
                  }),
                })
              }
              onChange={setStaffId}
            />
          </div>
        </div>
      </div>
      <UserRankingTable data={topUser} gameOrderStatus={gameOrderStatus} />
    </>
  );
}

function UserRankingTable({
  data,
  type,
  gameOrderStatus,
}: {
  data: any;
  type?: string;
  gameOrderStatus?: string;
}) {
  const { t } = useTranslation();

  return (
    <>
      <DataTable.Table className="mt-4" items={data} disableDbClick={true}>
        <DataTable.Column
          label={t("STT")}
          render={(item: User) => (
            <DataTable.CellText value={data.indexOf(item) + 1} className="max-w-xs" />
          )}
        />
        <DataTable.Column
          label={t("Mã")}
          render={(item: User) => <DataTable.CellText value={item.code} className="max-w-xs" />}
        />
        <DataTable.Column
          label={t("Tài khoản")}
          render={(item: User) => <DataTable.CellText value={item.name} className="max-w-xs" />}
        />

        <DataTable.Column
          right
          label={t("Số giao dịch")}
          render={(item: User) => <DataTable.CellNumber value={item.total} className="max-w-xs" />}
        />

        <DataTable.Column
          right
          label={t("Thu nhập tài khoản")}
          render={(item: User) => (
            <DataTable.CellNumber
              value={gameOrderStatus == GameOrderStatusEnum.COMPLETED ? item.fee : 0}
              className="max-w-xs"
            />
          )}
        />
        <DataTable.Column
          right
          label={t("Thu nhập sàn")}
          render={(item: User) => (
            <DataTable.CellNumber
              value={gameOrderStatus == GameOrderStatusEnum.COMPLETED ? item.exchangeFee : 0}
              className="max-w-xs"
            />
          )}
        />
      </DataTable.Table>
    </>
  );
}
