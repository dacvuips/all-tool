import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "../../../lib/providers/auth-provider";
import { PopupNotify, PopupNotifyService } from "../../../lib/repo/list/popup-notify.repo";

import { GameTypeEnum, PopupNotifyStatusEnum } from "../../../lib/repo/types";
import { Wallet, WalletService } from "../../../lib/repo/wallet/wallet.repo";

export const HomeLayoutContext = createContext<
  Partial<{
    streams: any;
    setStreams: (value: any) => any;
    popupNotifys?: PopupNotify[];
    setPopupNotifys?: (value: PopupNotify[]) => void;
    wallet: Wallet;
    setWallet: (value: Wallet) => void;
    getPopupNotify: () => void;
    categoryGlobal: string;
    categoryGlobalList: GameGroupedByType[];
    setCategoryGlobal: (value: string) => void;
    setCategoryStorage: ({ categoryType }: { categoryType: string }) => void;
    refreshWallet: () => void;
  }>
>({});
interface GameGroupedByType {
  type: GameTypeEnum;
  name: string;
  items: {
    logoUrl: string;
    id: string;
  }[];
}
export function HomeLayoutProvider(props) {
  const { customer } = useAuth();
  const router = useRouter();
  const [streams, setStreams] = useState<any>();
  const [popupNotifys, setPopupNotifys] = useState<PopupNotify[]>([]);
  const [wallet, setWallet] = useState<Wallet>();
  const [categoryGlobal, setCategoryGlobal] = useState<string>(null);

  useEffect(() => {
    getPopupNotify();
    if (customer) {
      getWalletInfo();
    }
  }, [customer]);

  const getPopupNotify = async () => {
    const localStoragePopupNotify = localStorage.getItem("popup-notify-adv");
    const popupNotifyIds = JSON.parse(localStoragePopupNotify) || [];

    await PopupNotifyService.getAll({
      fragment: "id data type link action",
      query: {
        order: { priority: -1 },
        filter: {
          _id: { $nin: popupNotifyIds },
          status: PopupNotifyStatusEnum.ACTIVE,
          startDate: { $lte: new Date() },
          endDate: { $not: { $lt: new Date() } },
        },
      },
    }).then((res) => {
      setPopupNotifys(res.data);
    });
  };

  const getWalletInfo = async () => {
    await WalletService.getInfo("balance id").then((res) => {
      setWallet(res);
    });
  };

  const setCategoryStorage = ({ categoryType }) => {
    localStorage.setItem("category-global", categoryType);
  };

  useEffect(() => {
    if (categoryGlobal) {
      !GameTypeEnum[categoryGlobal] && setCategoryGlobal(undefined);
    }
  }, [categoryGlobal]);

  return (
    <HomeLayoutContext.Provider
      value={{
        streams,
        setStreams,
        popupNotifys,
        setPopupNotifys,
        wallet,
        setWallet,
        getPopupNotify,
        categoryGlobal,
        setCategoryGlobal,
        setCategoryStorage,
        refreshWallet: getWalletInfo,
      }}
    >
      {props.children}
    </HomeLayoutContext.Provider>
  );
}
export const useHomeLayoutContext = () => useContext(HomeLayoutContext);
