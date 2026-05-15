import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { RiLogoutBoxRLine, RiNotification3Line, RiUser3Fill, RiWallet3Line } from "react-icons/ri";
import { Img } from "../../../components/shared/utilities/misc";
import { Dropdown } from "../../../components/shared/utilities/popover/dropdown";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useAdminLayoutContext } from "../providers/admin-layout-provider";

import { useTranslation } from "react-i18next";
import { MessageStaff } from "../../../components/shared/chat/admin/chat-message-staff";
import { ChatProvider } from "../../../components/shared/chat/chat-provider";
import { WalletTransactionDialog } from "../../../components/shared/common/wallet-transaction";
import { Button } from "../../../components/shared/utilities/form";
import { Pagination, QueryInput } from "../../../lib/repo/crud.repo";
import {
  NOTIFY_FRAGMENT,
  NotificationService,
} from "../../../lib/repo/notification/notification.repo";
import { SelectLanguage } from "../../default-header";

interface PropsType extends ReactProps {}
export function Header({ ...props }: PropsType) {
  const { t } = useTranslation();
  const userRef = useRef();

  const { wallet } = useAdminLayoutContext();
  const [openWalletTransaction, setOpenWalletTransaction] = useState<boolean>(false);

  const router = useRouter();
  const { user, logout } = useAuth();

  return (
    <>
      <div className="flex fixed top-0 left-0 z-50 justify-between items-center w-full h-14 bg-white shadow">
        <Link
          href="/"
          className="flex items-center px-6 py-3 h-full text-xl font-bold uppercase text-primary"
        >
          <img className="object-contain w-auto h-full" src="/assets/img/logo-full.png" />
          <div className="mx-4">{"StoreMMO"}</div>
        </Link>
        {/* <div className="flex items-center space-x-4 w-full h-full">
        {(breadcrumbs || linkAdress)
          .map((item, index, array) => {
            const isActive = index == array.length - 1;
            return (
              <div
                className={`${
                  isActive
                    ? "font-semibold text-gray-800"
                    : "text-gray-500 hover:text-gray-800 hover:underline"
                }`}
                key={item.path + index}
              >
                <Link href={item.path}>{item.title}</Link>
              </div>
            );
          })
          .reduce((accu, elem, index): any => {
            return accu === null
              ? [elem]
              : [
                  ...accu,
                  <i key={index} className="text-lg text-gray-400">
                    <RiArrowRightSLine />
                  </i>,
                  elem,
                ];
          }, null as any)}
      </div> */}

        {/* <div className="ml-auto" ref={notificationRef}>
        <Button icon={<RiNotification3Line />} />
      </div>
      <Popover placement="bottom" reference={notificationRef}>
        <div className="flex flex-wrap p-8 items">Thông báo</div>
      </Popover> */}
        <div className="flex flex-row gap-2 items-center">
          <SelectLanguage mode="desktop" />
          <ChatProvider senderRole="ADMIN">
            <MessageStaff />
          </ChatProvider>
          <NotifiCationDropdown />
          <div
            onClick={() => {
              setOpenWalletTransaction(true);
            }}
            className="px-3 py-2 pr-4 mr-4 whitespace-nowrap bg-gray-50 rounded transition-all cursor-pointer hover:border-yellow-500 min-w-28"
          >
            <div className="text-xs font-medium">{"mPoint"}</div>
            <div className="flex items-center text-yellow-500">
              <i className="mr-1">
                <RiWallet3Line />
              </i>
              {/* <div className="text-sm font-semibold">{currencyPrice(wallet?.balance)}đ</div> */}
            </div>
          </div>
          <WalletTransactionDialog
            isOpen={openWalletTransaction}
            onClose={() => setOpenWalletTransaction(false)}
          />
          {user && (
            <div
              className="flex items-center pr-8 pl-4 ml-auto border-l border-gray-100 cursor-pointer group"
              ref={userRef}
            >
              <Img compress={80} avatar className="w-8" src={user.avatar} alt="avatar" />
              <div className="pl-2 whitespace-nowrap">
                <div className="mb-1 font-semibold leading-4 text-gray-700 group-hover:text-primary">
                  {user.name}
                </div>
                <div className="text-sm leading-3 text-gray-600 group-hover:text-primary">
                  {user.email}
                </div>
              </div>
            </div>
          )}
        </div>

        <Dropdown reference={userRef}>
          <Dropdown.Item
            icon={<RiUser3Fill />}
            text={t("Hồ sơ của tôi")}
            hoverAccent
            href={{ pathname: "/admin/management/profile-user" }}
          />
          <Dropdown.Divider />
          <Dropdown.Item
            hoverDanger
            icon={<RiLogoutBoxRLine />}
            text={t("Đăng xuất")}
            onClick={async () => {
              await logout()
                .then(() => router.replace("/admin"))
                .catch((res) => router.replace("/admin"));
            }}
          />
        </Dropdown>
      </div>
    </>
  );
}

export function NotifiCationDropdown() {
  const { t } = useTranslation();
  const notificationRef = useRef();
  const { user } = useAuth();
  const router = useRouter();
  const { notificationCount } = useAdminLayoutContext();
  const [items, setItems] = useState<any[]>();
  const [pagination, setPagination] = useState<Pagination>({
    total: 0,
    offset: 1,
    page: 1,
    limit: 10,
  });

  const queryRef = useRef<QueryInput>({
    limit: 5,
    order: { _id: -1 },
  });
  const loadAll = (query: QueryInput = {}) => {
    queryRef.current = { ...queryRef.current, ...query };
    return NotificationService.getUserNotification({
      query: queryRef.current,

      fragment: NOTIFY_FRAGMENT,
    }).then((res) => {
      setItems(res.data);
      setPagination(res.pagination);
      return res.data;
    });
  };
  useEffect(() => {
    loadAll();
  }, [user, router.pathname]);
  return (
    <div className="relative">
      <Button
        icon={<RiNotification3Line />}
        iconClassName="text-xl"
        tooltip={t("Thông báo")}
        className={`h-14 hover:bg-gray-100`}
        innerRef={notificationRef}
      />
      {!!notificationCount && (
        <div className="absolute top-1 right-3 px-1 text-xs font-semibold text-white bg-red-500 rounded-full">
          {notificationCount >= 9 ? "9+" : notificationCount}
        </div>
      )}
      {/* <Popover reference={notificationRef} trigger="hover" placement="bottom-end">
        <NotifyDropdown loadAll={loadAll} pagination={pagination} items={items} />
      </Popover> */}
    </div>
  );
}
