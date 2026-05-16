import { useRouter } from "next/router";

import { useTranslation } from "react-i18next";
import { BsFillBellFill } from "react-icons/bs";
import { formatDate } from "../../../lib/helpers/parser";
import { useScreen } from "../../../lib/hooks/useScreen";
import { Pagination, QueryInput } from "../../../lib/repo/crud.repo";
import {
  Notification,
  NotificationService,
} from "../../../lib/repo/notification/notification.repo";
import { Button } from "../utilities/form";
import { NotFound, Spinner } from "../utilities/misc";
import { PaginationComponent } from "../utilities/pagination/pagination-component";

type Props = {
  loadAll: (query?: QueryInput) => void;
  items: Notification[];
  pagination: Pagination;
};

export function NotifyDropdown({ loadAll, items, pagination, ...props }: ReactProps & Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const xs2 = useScreen("2xs");
  const xs = useScreen("xs");

  async function handleNotiOnClick(noti: Notification) {
    try {
      if (noti.seen == false) {
        await NotificationService.readNotification(noti.id);
      }
      await loadAll();

      // handle notification action type
      switch (noti.type) {
        case "WEBSITE": {
          window.open(noti.link, "__blank");
          break;
        }
        case "TRANSACT": {
          router.push(`${noti.transactLink}`);
          break;
        }
        case "WALLET": {
          router.push(`${noti.walletLink}`);
          break;
        }
      }
    } catch (error) {
      console.error(error);
    }
  }

  const paginationButtonClass =
    "min-w-6 h-6 font-semibold border border-gray-400 text-gray-600 hover:text-primary hover:border-primary disabled:cursor-not-allowed disabled:opacity-50 rounded-full";

  if (!items) return <Spinner />;
  return (
    <div
      className={` py-2 overflow-auto bg-white  ${xs ? "w-96" : "w-full"}`}
      style={{ maxHeight: 600 }}
    >
      {items ? (
        items.length > 0 ? (
          <div className={`flex flex-col itrm-center  ${xs ? "w-96" : "w-full"}`}>
            <div className="border-b border-gray-200 v-scrollbar" style={{ height: "300px" }}>
              <div className="flex flex-col pb-2">
                {items.map((noti: Notification, index) => (
                  <div
                    className={` cursor-pointer rounded-md w-full mb-0.5 hover:bg-gray-100  ${
                      noti.seen ? "" : "bg-primary-light"
                    } ${index < items.length - 1 ? "border-b" : ""}`}
                    key={index}
                    onClick={async () => handleNotiOnClick(noti)}
                  >
                    <div className="flex flex-row items-center pl-1">
                      <div className={noti.seen ? "text-gray-400" : "relative text-primary-dark"}>
                        {noti.seen ? (
                          ""
                        ) : (
                          <div className="absolute right-0 w-1.5 h-1.5 rounded-full bg-danger"></div>
                        )}
                        <BsFillBellFill />
                      </div>
                      <span className="ml-2 font-semibold">{noti?.title}</span>
                    </div>
                    <div className="pl-5 font-small text-12">{noti?.body}</div>
                    <div className="w-full pr-2 text-right">
                      <span className="text-right text-12">
                        {formatDate(noti?.createdAt, "HH:mm dd-MM-yyyy")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-row justify-between mt-2 -mb-2 ">
              <PaginationComponent
                visiblePageCount={xs2 ? 4 : 2}
                page={pagination.page}
                limit={pagination.limit}
                total={pagination.total}
                onPageChange={(page) => loadAll({ page })}
                firstButtonClass={paginationButtonClass}
                lastButtonClass={paginationButtonClass}
                prevButtonClass={paginationButtonClass}
                nextButtonClass={paginationButtonClass}
                pageButtonClass={paginationButtonClass}
                pageActiveButtonClass={
                  "min-w-6 h-6 font-semibold border border-primary bg-primary text-white rounded-full"
                }
              />

              <Button
                className="h-5 px-0 sm:text-14 text-12 whitespace-nowrap"
                text={t("Xem thêm")}
                onClick={() => {
                  if (router.pathname?.includes("/shop")) {
                    router.push("/shop/notifications");
                  }
                  if (router.pathname?.includes("/admin")) {
                    router.push("/admin/management/notifications");
                  }
                  if (router.pathname?.includes("/partner")) {
                    router.push("/partner/notifications");
                  } else {
                    router.push("/profile/notification");
                  }
                }}
              ></Button>
            </div>
          </div>
        ) : (
          <NotFound text={t("không có thông báo")} />
        )
      ) : (
        <Spinner />
      )}
    </div>
  );
}
