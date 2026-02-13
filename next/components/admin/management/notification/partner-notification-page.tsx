import { useEffect, useState } from "react";

import { useRouter } from "next/router";
import { Pagination } from "../../../../lib/repo/crud.repo";
import {
  NOTIFY_FRAGMENT,
  NotificationService,
} from "../../../../lib/repo/notification/notification.repo";
import { Card } from "../../../shared/utilities/misc";

export function AdminNotificationPage({ ...props }) {
  const router = useRouter();
  const [notify, setNotify] = useState<any>();
  const [textSearch, setTextSearch] = useState<string>(undefined);
  const [notifyType, setNotifyType] = useState<string>();
  const [filter, setFilter] = useState<any>({});
  const [timeRange, setTimeRange] = useState<any>(null);
  const [seen, setSeen] = useState<any>();
  const GetNotification = async (page?: Pagination) => {
    await NotificationService.getUserNotification({
      cache: false,
      fragment: NOTIFY_FRAGMENT,
      query: {
        filter: { status: props.status, type: notifyType || undefined, ...filter },
        page: page?.page,
        search: textSearch,
      },
    })
      .then((res) => {
        setNotify(res);
      })
      .catch((err) => {});
  };

  useEffect(() => {
    GetNotification();
  }, [textSearch, notifyType, router.pathname, filter]);
  useEffect(() => {
    setFilter({
      ...(timeRange ? { createdAt: { $gte: timeRange.startDate, $lte: timeRange.endDate } } : {}),
      ...(seen !== "" ? { seen: seen } : {}),
    });
  }, [timeRange, seen]);
  return (
    <Card>
      {/* <NotificationTable
        getNotification={GetNotification}
        setTextSearch={setTextSearch}
        notify={notify}
        setNotifyType={setNotifyType}
        setTimeRange={setTimeRange}
        timeRange={timeRange}
        setSeen={setSeen}
      /> */}
    </Card>
  );
}
