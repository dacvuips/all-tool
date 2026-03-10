import { useRouter } from "next/router";
import { createContext, useContext, useEffect, useState } from "react";
import { CustomerChangePasswordDialog } from "../../components/shared/auth/customer/customer-change-password-dialog";
import { CustomerForgotPasswordDialog } from "../../components/shared/auth/customer/customer-forgot-password-dialog";
import { CustomerLoginDialog } from "../../components/shared/auth/customer/customer-login/customer-login-dialog";
import { CustomerRegisterDialog } from "../../components/shared/auth/customer/customer-register-dialog";

import { useScreen } from "../hooks/useScreen";

import { useQuery } from "../hooks/useQuery";
import { NotificationService } from "../repo/notification/notification.repo";
import { Post, PostService } from "../repo/post/post.repo";
import { useAuth } from "./auth-provider";

export const GlobalContext = createContext<
  Partial<{
    openCustomerLoginDialog: boolean;
    setOpenCustomerLoginDialog: (val: boolean) => any;
    openRegisGlobalCollDialog: boolean;
    setOpenRegisGlobalCollDialog: (val: boolean) => any;
    openShopRegistrationDialog: "ENTERPRISE" | "SALE_POINT" | undefined;
    setOpenShopRegistrationDialog: (val: "ENTERPRISE" | "SALE_POINT" | undefined) => any;
    openChangePasswordDialog: boolean;
    setOpenChangePasswordDialog: (val: boolean) => any;
    openCustomerForgotPasswordDialog: string;
    setOpenCustomerForgotPasswordDialog: (val: string) => any;
    idToken: string;
    setIdToken: (token: string) => any;
    openRegisCustomerDialog: string;
    setOpenRegisCustomerDialog: (val: any) => any;
    openRegisShopDialog: boolean;
    setOpenRegisShopDialog: (val: any) => any;

    postPopup: Post;
    setPostPopup: (value: Post) => void;
    notificationCount: number;
    setNotificationCount: (value: number) => void;
    openCardMenu: boolean;
    setOpenCardMenu: (value: boolean) => void;
    openSidebarSlideout: boolean;
    setOpenSidebarSlideout: (value: boolean) => void;
  }>
>({});

export function GlobalProvider(props) {
  const screenLg = useScreen("lg");
  const router = useRouter();

  const { customer } = useAuth();
  const [openCustomerLoginDialog, setOpenCustomerLoginDialog] = useState(false);
  const [openRegisGlobalCollDialog, setOpenRegisGlobalCollDialog] = useState(false);

  const [openChangePasswordDialog, setOpenChangePasswordDialog] = useState(false);
  const [openCustomerForgotPasswordDialog, setOpenCustomerForgotPasswordDialog] = useState<
    string | undefined
  >();
  const [idToken, setIdToken] = useState<string>();
  const [openRegisCustomerDialog, setOpenRegisCustomerDialog] = useState(null);
  const [openRegisShopDialog, setOpenRegisShopDialog] = useState<boolean>(false);
  const [notificationCount, setNotificationCount] = useState<number>();
  const [postPopup, setPostPopup] = useState<Post>();
  const [openCardMenu, setOpenCardMenu] = useState(false);
  const [openSidebarSlideout, setOpenSidebarSlideout] = useState(false);
  const loginQuery: string = useQuery("login");

  // Thời hạn 3 Giờ
  const expired = 10800000;
  const date = new Date().getTime();

  useEffect(() => {
    const getPostPopupExpireTime = localStorage.getItem("post-popup-timeout");
    if (+getPostPopupExpireTime < date) {
      PostService.getPostPopup()
        .then((res) => {
          localStorage.setItem("post-popup-timeout", JSON.stringify(date + expired));
          setPostPopup(res);
        })
        .catch((err) => {
          console.log(err);
        });
    }
  }, []);

  useEffect(() => {
    loginQuery && setOpenCustomerLoginDialog(true);
    customer && notifyCount();
  }, [customer, router.pathname]);

  const notifyCount = async () => {
    await NotificationService.getCustomerNotification({
      query: { limit: 10, filter: { seen: false }, order: { createdAt: -1 } },
      fragment: "id",
      cache: false,
    }).then((res) => {
      setNotificationCount([...res.data].length);
    });
  };

  return (
    <GlobalContext.Provider
      value={{
        openCustomerLoginDialog,
        setOpenCustomerLoginDialog,
        openRegisGlobalCollDialog,
        setOpenRegisGlobalCollDialog,
        openRegisShopDialog,
        setOpenRegisShopDialog,
        openChangePasswordDialog,
        setOpenChangePasswordDialog,
        openCustomerForgotPasswordDialog,
        setOpenCustomerForgotPasswordDialog,
        idToken,
        setIdToken,
        openRegisCustomerDialog,
        setOpenRegisCustomerDialog,
        postPopup,
        setPostPopup,
        notificationCount,
        setNotificationCount,
        openCardMenu,
        setOpenCardMenu,
        openSidebarSlideout,
        setOpenSidebarSlideout,
      }}
    >
      {props.children}

      <CustomerLoginDialog
        isOpen={openCustomerLoginDialog}
        onClose={() => {
          setOpenCustomerLoginDialog(false);
        }}
      />
      <CustomerChangePasswordDialog
        isOpen={openChangePasswordDialog}
        onClose={() => {
          setOpenChangePasswordDialog(false);
        }}
        mobileSizeMode={!screenLg}
        slideFromBottom="none"
      />
      <CustomerRegisterDialog
        isOpen={!!openRegisCustomerDialog}
        idToken={openRegisCustomerDialog}
        onClose={() => {
          setOpenRegisCustomerDialog(null);
        }}
        mobileSizeMode={!screenLg}
        slideFromBottom="none"
      />
      <CustomerForgotPasswordDialog
        isOpen={!!openCustomerForgotPasswordDialog}
        onClose={() => {
          setOpenCustomerForgotPasswordDialog(undefined);
        }}
      />
    </GlobalContext.Provider>
  );
}

export const useGlobalContext = () => useContext(GlobalContext);
