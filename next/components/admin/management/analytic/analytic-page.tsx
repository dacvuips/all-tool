import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { parseNumber } from "../../../../lib/helpers/parser";
import { AnalyticService, Overview } from "../../../../lib/repo/analytic/analytic.repo";
import { Card, Spinner } from "../../../shared/utilities/misc";
import { UserRanking } from "./components/user-ranking";

export function AnalyticPage(props) {
  const { t } = useTranslation();
  const [loadDone, setLoadDone] = useState(false);
  const [overview, setOverview] =
    useState<{ reportShopProduct: Overview[]; reportGameOrder: Overview[] }>();

  useEffect(() => {
    let tasks = [];

    tasks.push(
      AnalyticService.getOverviewAnalytic().then((res: any) => {
        setOverview(res);
      })
    );

    Promise.all(tasks).finally(() => {
      setLoadDone(true);
    });
  }, []);

  return (
    <div className="w-full min-w-7xl">
      {loadDone ? (
        <div className="grid grid-cols-2 gap-3 animate-emerge-up">
          {/* <OverviewStatistics overview={overview.reportShopProduct} /> */}
          {/* <OverviewStatistics
            title={t("Thống kê đơn hàng giao dịch")}
            overview={overview.reportGameOrder}
          /> */}
          <UserRanking />
        </div>
      ) : (
        <Spinner />
      )}
    </div>
  );
}

function OverviewStatistics({ overview, title }: { overview: Overview[]; title?: string }) {
  const { t } = useTranslation();
  if (!overview) return null;
  return (
    <Card className="col-span-full">
      <div className="mb-2 text-base font-semibold">
        {title || t("Thống kê khách và bài đăng")}
        <span className="ml-3 text-sm font-normal text-gray-500">
          {t("Thống kê tổng quan tính đến thời điểm hiện tại")}
        </span>
      </div>
      <div className="flex space-x-3">
        {overview.map((item, index) => (
          <div
            key={index}
            className="flex flex-col flex-1 p-3 text-center rounded border border-gray-300"
          >
            <div className="text-sm font-semibold text-gray-600 uppercase whitespace-nowrap">
              {t(`${item.title}`)}
            </div>
            <div className="pt-2 mt-auto text-2xl font-bold text-primary">
              {parseNumber(item.data)}
            </div>
            <div className="text-base font-semibold text-primary">{t(`${item.unit}`)}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}
