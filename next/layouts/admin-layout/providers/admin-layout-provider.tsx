import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState } from "react";

import { Menu } from "../components/sidebar";
import { useAuth } from "../../../lib/providers/auth-provider";
import { Wallet, WalletService } from "../../../lib/repo/wallet/wallet.repo";
import { NotificationService } from "../../../lib/repo/notification/notification.repo";

export const AdminLayoutContext = createContext<
  Partial<{
    pendingRegistrations: number;
    checkPendingRegistrations: () => any;

    sidebarMenu: Menu[];
    setSidebarMenu: any;
    wallet: Wallet;
    setWallet: (value: Wallet) => void;
    notificationCount: number;
    setNotificationCount: (value: number) => void;
  }>
>({});
export function AdminLayoutProvider(props) {
  const { user } = useAuth();
  const [sidebarMenu, setSidebarMenu] = useState<Menu[]>();
  const [wallet, setWallet] = useState<Wallet>();
  const [notificationCount, setNotificationCount] = useState<number>();
  const router = useRouter();
  const { logout } = useAuth();
  useEffect(() => {
    GetWalletInfo();
  }, []);
  useEffect(() => {
    if (sidebarMenu) {
      let menu = [];
      sidebarMenu.map((x) =>
        x.submenus.map((y) => {
          if (y.hidden != true) {
            menu.push(y);
          }
        })
      );
      const pathName = menu.some((x) => x.path == router.pathname);
      if (!pathName) {
        if (menu.length > 0) {
          router.replace(`${menu[0].path}`);
        } else {
          logout().then(() => {
            router.replace(`/admin/login`);
          });
        }
      }
    }
  }, [sidebarMenu]);
  const GetWalletInfo = async () => {
    await WalletService.getInfo().then((res) => {
      setWallet(res);
    });
  };
  useEffect(() => {
    user && notifyCount();
  }, [user, router.pathname]);
  const notifyCount = async () => {
    await NotificationService.getUserNotification({
      query: { limit: 10, filter: { seen: false }, order: { createdAt: -1 } },
      fragment: "id",
      cache: false,
    }).then((res) => {
      setNotificationCount([...res.data].length);
    });
  };
  return (
    <AdminLayoutContext.Provider
      value={{
        sidebarMenu,
        setSidebarMenu,
        wallet,
        setWallet,
        notificationCount,
        setNotificationCount,
      }}
    >
      {props.children}
    </AdminLayoutContext.Provider>
  );
}

export const useAdminLayoutContext = () => useContext(AdminLayoutContext);
