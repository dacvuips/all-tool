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

export function UserRanking() {
  return (
    <>
      <div className="col-span-full">
        <div className="grid grid-cols-12 gap-3 mb-3">
          <Card className="col-span-6">
            <TopTransactionUsers />
          </Card>
          <Card className="col-span-6">
            <TopTransactionFeeUsers />
          </Card>
        </div>
      </div>
    </>
  );
}

export function TopTransactionUsers({ month }: { month?: string }) {
  const { t } = useTranslation();

  const [topUser, setTopUser] = useState<any[]>();
  const [valueDate, setValueDate] = useState<{ startDate: Date; endDate: Date }>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });
  const [gameOrderStatus, setGameOrderStatus] = useState<String>(GameOrderStatusEnum.COMPLETED);
  const { GAME_ORDER_STATUS_OPTION } = useOptionsTranslation();
  useEffect(() => {
    // GetTopUser();
  }, [valueDate, gameOrderStatus]);
  const GetTopUser = async () =>
    await AnalyticService.getTopTransactionUser(
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
          <div className="font-semibold">{t("Thống kê giao dịch")}</div>
          <span className="text-sm font-normal text-gray-500">{t("Top giao dịch")}</span>
        </div>
        <div className="flex gap-2 items-center">
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
              clearable
              autosize
              options={GAME_ORDER_STATUS_OPTION}
              value={gameOrderStatus}
              onChange={(value) => {
                setGameOrderStatus(value);
              }}
            />{" "}
          </div>
        </div>
      </div>
      <UserRankingTable data={topUser} />
    </>
  );
}
export function TopTransactionFeeUsers({ month }: { month?: string }) {
  const { t } = useTranslation();

  const [topUser, setTopUser] = useState<any[]>();
  const [valueDate, setValueDate] = useState<{ startDate: Date; endDate: Date }>({
    startDate: startOfMonth(new Date()),
    endDate: endOfMonth(new Date()),
  });

  useEffect(() => {
    // GetTopUser();
  }, [valueDate]);
  const GetTopUser = async () =>
    await AnalyticService.getTopTransactionFeeUser(valueDate?.startDate, valueDate?.endDate).then(
      (res) => {
        setTopUser(res);
      }
    );

  return (
    <>
      <div className="flex flex-row justify-between my-2">
        <div>
          <div className="font-semibold">{t("Thống kê thu nhập")}</div>
          <span className="text-sm font-normal text-gray-500">{t("Top thu nhập")}</span>
        </div>
        <div className="flex gap-2 items-center">
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
        </div>
      </div>
      <UserRankingTable data={topUser} type="FEE" />
    </>
  );
}
function UserRankingTable({ data, type }: { data: any; type?: string }) {
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
        {type == "FEE" ? (
          <DataTable.Column
            right
            label={t("Thu nhập")}
            render={(item: User) => <DataTable.CellNumber value={item.fee} className="max-w-xs" />}
          />
        ) : (
          <></>
        )}
      </DataTable.Table>
    </>
  );
}
