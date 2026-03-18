import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineBell } from "react-icons/ai";
import { BiExit } from "react-icons/bi";
import {
  RiArrowRightSLine,
  RiBankCardLine,
  RiImageLine,
  RiQuestionLine,
  RiUser3Line,
} from "react-icons/ri";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { Button } from "../../shared/utilities/form";
import { Img, Spinner } from "../../shared/utilities/misc";

export const ProfilePageWebapp = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const alert = useAlert();
  const toast = useToast();
  const { customer, logoutCustomer } = useAuth();
  const MENU_LIST = MenuList();

  useEffect(() => {
    if (customer === null) {
      router.replace("/");
      toast.info(t("Vui lòng đăng nhập để truy cập"));
    }
  }, [customer]);

  if (!customer) return <Spinner />;

  return (
    <div className="flex-1 bg-white rounded-md">
      <div className="px-3 py-6 text-sm main-container text-accent md:text-base">
        <div className="flex gap-2 items-center">
          <Img className="w-12" avatar src={customer?.avatarUrl} />
          <div className="pl-2.5 w-full overflow-ellipsis">
            <div className="text-gray-500">{"Tài khoản của"}</div>
            <div className="text-base font-bold whitespace-nowrap md:text-lg text-ellipsis">
              {customer?.name || customer?.phoneNumber}
            </div>
            {customer.status == "ACTIVE" ? (
              <div className="flex flex-row items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <div className="ml-2 text-green-500">{t("Đang hoạt động")}</div>
              </div>
            ) : (
              <div className="flex flex-row items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <div className="ml-2 text-red-500">{t("Bị khóa")}</div>
              </div>
            )}
          </div>
        </div>
        <div className="gap-1 my-2 flex-cols">
          {MENU_LIST.map((menu, index) => (
            <Link href={menu.href} key={index}>
              <div className="flex flex-row items-center" key={index}>
                <div className="flex flex-1 gap-2 items-center">
                  <i className="text-lg text-primary">{menu.icon}</i>
                  <div className="font-semibold">{menu.label}</div>
                </div>
                <Button
                  icon={<RiArrowRightSLine />}
                  iconClassName="text-gray-400 text-2xl"
                  className="px-0"
                />
              </div>
            </Link>
          ))}
        </div>
        <div
          className="flex gap-2 items-center mt-3"
          onClick={async () => {
            const res = await alert.warn(t("Đăng xuất"));
            if (!res) return;
            await logoutCustomer();
            toast.success(t("Đăng xuất thành công!"));
          }}
        >
          <i className="text-xl text-primary">
            <BiExit />
          </i>
          <div className="font-semibold">{t("Đăng xuất")}</div>
        </div>
      </div>
    </div>
  );
};

const MenuList = () => {
  const { t } = useTranslation();
  return [
    {
      href: "/profile/account",
      label: t("Hồ sơ của tôi"),
      icon: <RiUser3Line />,
    },
    {
      href: "/profile/media-gallery",
      label: t("Thư viện Media"),
      icon: <RiImageLine />,
    },
    { label: t("Nạp ví"), icon: <RiBankCardLine />, href: "/checkout" },
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
