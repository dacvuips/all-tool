import { useRouter } from "next/router";
import { useEffect, useMemo } from "react";
import { AiOutlineBell, AiOutlineUser } from "react-icons/ai";

import { useAuth } from "../../../lib/providers/auth-provider";
import { BreadCrumbs, Spinner } from "../../shared/utilities/misc";
import { ProfileAccount } from "./components/account/profile-account";

import { useTranslation } from "react-i18next";
import {
  RiBankCardLine,
  RiExchangeLine,
  RiImageLine,
  RiQuestionLine,
  RiShoppingCart2Line,
  RiUserHeartLine,
} from "react-icons/ri";
import { useToast } from "../../../lib/providers/toast-provider";

import { ProfileCredential } from "./components/credential/profile-credential";
import { ProfileIntroduce } from "./components/introduce/profile-introduce";
import { ProfileMediaGallery } from "./components/media-gallery/profile-media-gallery";
import { ProfileNotificationPage } from "./components/notification/profile-notification-page";
import { ProfileOrderBuyPage } from "./components/order-buy/order-buy-page";
import { ProfilePackageTransactionPage } from "./components/package-transaction/profile-package-transaction-page";
import { ProfileTrainingPage } from "./components/training/training-page";
import { ProfileMenu } from "./profile-menu";

export function ProfilePage({ ...props }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { customer } = useAuth();
  const toast = useToast();

  const PROFILE_MENUS = ProfileMenuList();

  useEffect(() => {
    if (customer === null) {
      router.replace("/");
      toast.info(t("Vui lòng đăng nhập để truy cập"));
    }
  }, [customer]);

  const selectedMenu = useMemo(
    () => PROFILE_MENUS.find((x) => router.pathname.includes(x.href)),
    [router.pathname]
  );

  if (!customer) return <Spinner />;

  return (
    <section>
      <div className="bg-white rounded-full">
        <BreadCrumbs
          className="relative z-10 py-2 pl-4 my-5"
          breadcrumbs={[
            {
              href: "/",
              label: t("Trang chủ"),
            },
            {
              href: `/profile/account`,
              label: t("Tài khoản"),
            },
            ...(selectedMenu
              ? [
                  {
                    label: selectedMenu.label as string,
                  },
                ]
              : []),
          ]}
        />
      </div>
      <div className="flex flex-col">
        <ProfileMenu selectedMenu={selectedMenu} />
        <div className="flex-1 mt-2 ">
          {
            <div className="">
              {selectedMenu ? (
                <>
                  {
                    {
                      "/profile/account": <ProfileAccount />,
                      // "/profile/deposit": <ProfileDepositPage />,
                      "/profile/notification": <ProfileNotificationPage />,
                      "/profile/trainings": <ProfileTrainingPage />,
                      "/profile/credential": <ProfileCredential />,
                      "/profile/orders-buy": <ProfileOrderBuyPage />,
                      "/profile/media-gallery": <ProfileMediaGallery />,
                      "/profile/package-transactions": <ProfilePackageTransactionPage />,
                      "/profile/introduce": <ProfileIntroduce />,
                    }[selectedMenu.href]
                  }
                </>
              ) : (
                <ProfileAccount />
              )}
            </div>
          }
        </div>
      </div>
    </section>
  );
}

export const ProfileMenuList = () => {
  const { t } = useTranslation();
  return [
    { label: t("Hồ sơ của tôi"), icon: <AiOutlineUser />, href: "/profile/account" },
    { label: t("Giới thiệu"), icon: <RiUserHeartLine />, href: "/profile/introduce" },
    { label: t("Giao dịch gói"), icon: <RiExchangeLine />, href: "/profile/package-transactions" },
    { label: t("Đơn mua"), icon: <RiShoppingCart2Line />, href: "/profile/orders-buy" },
    { label: t("Thư viện Media"), icon: <RiImageLine />, href: "/profile/media-gallery" },
    { label: t("Nạp gói"), icon: <RiBankCardLine />, href: "/checkout" },
    // { label: t("API Key"), icon: <RiKey2Line />, href: "/profile/credential" },
    {
      label: t("Thông báo"),
      icon: <AiOutlineBell />,
      href: "/profile/notification",
    },
    {
      label: t("Hướng dẫn"),
      icon: <RiQuestionLine />,
      href: "/profile/trainings",
    },
  ];
};
