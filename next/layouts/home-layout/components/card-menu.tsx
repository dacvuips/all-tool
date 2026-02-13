import Link from "next/link";
import { useRouter } from "next/router";
import { ReactElement, useEffect } from "react";
import { Scrollbars } from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import { HiOutlineShare, HiOutlineX } from "react-icons/hi";
import { MdOutlineLanguage } from "react-icons/md";
import {
  RiArrowRightSLine,
  RiCustomerService2Line,
  RiFileList2Line,
  RiHome5Line,
  RiLoginBoxLine,
  RiLogoutBoxRLine,
  RiQuestionLine,
  RiShoppingCart2Line,
  RiUser3Line,
  RiVideoLine,
} from "react-icons/ri";

import { Slideout, SlideoutProps } from "../../../components/shared/utilities/dialog/slideout";
import { Button } from "../../../components/shared/utilities/form";
import { Img } from "../../../components/shared/utilities/misc";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { SelectLanguage } from "../../default-header";
import { Category } from "./category";

export const useGlobalMenuConstants = () => {
  const { t } = useTranslation();
  const GLOBAL_MENUS = [
    {
      href: "/",
      label: t("Trang chủ"),
      icon: <RiHome5Line />,
    },
    // {
    //   href: "/stores",
    //   label: "Cửa hàng",
    //   icon: <RiStore2Line />,
    // },
    // {
    //   href: "/products",
    //   label: "Sản phẩm",
    //   icon: <RiInboxLine />,
    // },
    // {
    //   href: "/",
    //   label: "Giới thiệu",
    //   icon: <RiFileList2Line />,
    // },
    {
      href: "/post",
      label: t("Hướng dẫn"),
      icon: <RiQuestionLine />,
      // requireGlobalCustomer: true,
    },
    {
      href: "/profile",
      label: t("Tài khoản"),
      icon: <RiUser3Line />,
      requireCustomer: true,
    },
    // {
    //   href: "/card",
    //   label: t("Thẻ game"),
    //   icon: <RiBankCardLine />,
    //   // requireCustomer: true,
    // },
    // {
    //   href: "/products",
    //   label: t("Mua/Bán"),
    //   icon: <FiShoppingCart />,
    //   // requireCustomer: true,
    // },
    {
      name: "login",
      href: "",
      label: t("Đăng nhập"),
      icon: <RiLoginBoxLine />,
      // requireCustomer: true,
    },
    {
      name: "logout",
      href: "",
      label: t("Đăng xuất"),
      icon: <RiLogoutBoxRLine />,
      // requireCustomer: true,
    },
  ];

  const GLOBAL_SUBMENUS = [
    // {
    //   name: "notification",
    //   label: "Thông báo",
    //   icon: <AiOutlineBell />,
    //   href: "/profile",
    // },
    {
      name: "orderBuy",
      label: t("Đơn mua"),
      icon: <RiShoppingCart2Line />,
      href: "/profile/game-orders-buy",
    },
    // {
    //   name: "orderSell",
    //   label: t("Đơn trung gian bán"),
    //   icon: <RiHandCoinLine />,
    //   href: "/profile/game-orders-sell",
    // },
    // {
    //   name: "orderHistory",
    //   label: t("Đơn mua thẻ game"),
    //   icon: <RiShoppingBag3Line />,
    //   href: "/profile/orders",
    // },
  ];

  const SHOP_MENUS = [
    {
      href: "/information",
      label: t("Giới thiệu"),
      icon: <RiFileList2Line />,
    },
    // {
    //   href: "/regis-sale-point",
    //   label: "Đăng ký điểm bán",
    //   icon: <RiMapPinAddLine />,
    // },
    // {
    //   href: "/wheel",
    //   label: "Vòng quay may mắn",
    //   icon: <RiFootballLine />,
    //   requireLogin: true,
    // },
    // {
    //   label: "Chat với chúng tôi",
    //   icon: <RiChat1Line />,
    //   href: `/chat`,
    //   requireLogin: true,
    // },
    {
      label: t("Video"),
      icon: <RiVideoLine />,
      href: `/videos`,
      requireLogin: true,
    },
    {
      label: t("Hỗ trợ"),
      icon: <RiCustomerService2Line />,
      href: `/support`,
    },
  ];
  return {
    GLOBAL_MENUS,
    GLOBAL_SUBMENUS,
    SHOP_MENUS,
  };
};

export function CardMenu({ ...props }: SlideoutProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const toast = useToast();
  const alert = useAlert();
  const { customer, logoutCustomer } = useAuth();
  const { setOpenCustomerLoginDialog, setOpenRegisShopDialog } = useGlobalContext();

  const { GLOBAL_MENUS, GLOBAL_SUBMENUS } = useGlobalMenuConstants();

  useEffect(() => {
    props.onClose();
  }, [router.pathname]);
  return (
    <>
      <Slideout
        {...props}
        width="90vw"
        maxWidth={320}
        minWidth={290}
        placement="right"
        hasCloseButton={false}
      >
        <div
          className="flex justify-between items-center pl-5 h-12"
          onClick={() => props.onClose()}
        >
          <div className="font-bold text-accent">{t("Menu")}</div>
          <Button textAccent icon={<HiOutlineX />} />
        </div>
        <Scrollbars
          className="grid grid-cols-12 gap-x-5"
          style={{
            height: "100%",
          }}
        >
          <div className="grid grid-cols-4 gap-1 px-3">
            {GLOBAL_MENUS.map((menu) => {
              if (!!customer && menu.name == "login") {
                return;
              }
              if (!customer && menu.name == "logout") {
                return;
              }
              return (
                <Img noImage key={menu.label}>
                  <Link
                    href={menu.requireCustomer && !customer ? router.asPath : menu.href}
                    className="flex absolute top-0 left-0 flex-col justify-center items-center p-2 w-full h-full rounded border border-gray-200 cursor-pointer hover:border-primary"
                    onClick={() => {
                      if (menu.requireCustomer && !customer) {
                        toast.info(t("Vui lòng đăng nhập để tiếp tục."));
                        props.onClose();
                        setTimeout(() => {
                          setOpenCustomerLoginDialog(true);
                        }, 300);
                      }
                      if (menu.name == "login") {
                        setTimeout(() => {
                          setOpenCustomerLoginDialog(true);
                        }, 300);
                      }
                      if (menu.name == "logout") {
                        setTimeout(async () => {
                          await logoutCustomer();
                          props.onClose();
                        }, 300);
                      }
                    }}
                  >
                    <i className="text-2xl text-primary">{menu.icon}</i>
                    <div className="mt-1 text-xs font-semibold text-center whitespace-nowrap text-accent">
                      {menu.label}
                    </div>
                  </Link>
                </Img>
              );
            })}
          </div>
          {customer && (
            <>
              <Link
                href={`/profile`}
                className="flex items-center px-4 mt-4 h-12 text-white bg-primary"
              >
                <Img
                  src={customer?.avatarUrl ? customer?.avatarUrl : "/assets/default/avatar.png"}
                  className="mr-2 w-10 bg-white rounded-full border"
                />
                <div className="flex flex-row justify-between items-center w-full">
                  <div className="flex-1">
                    <div className="flex-1 text-sm font-semibold text-ellipsis">
                      {customer?.name}
                    </div>
                  </div>
                  <i className="block text-xl">
                    <RiArrowRightSLine />
                  </i>
                </div>
              </Link>

              <div className="flex flex-col ml-5">
                {GLOBAL_SUBMENUS.map((menu, index) => (
                  <a
                    key={index}
                    className={`flex items-center  py-2.5 px-0.5 cursor-pointer text-accent hover:text-accent-dark ${
                      GLOBAL_SUBMENUS.length != index + 1 ? "border-b border-gray-200" : ""
                    }`}
                    onClick={() => {
                      props.onClose();
                      router.replace(menu.href);
                    }}
                  >
                    <i className="text-primary">{menu.icon}</i>
                    <div className="pl-2 text-sm font-medium">{menu.label}</div>
                  </a>
                ))}
              </div>
            </>
          )}
          <Category onClose={props.onClose} />
          <CategorySelectLanguage />
          <CategoryGroup />
        </Scrollbars>
      </Slideout>
    </>
  );
}
const CategoryHeader = ({ icon, text }: { icon: ReactElement; text: string }) => {
  return (
    <div className="flex flex-row gap-1 items-center pl-1 my-3 ml-2 border-l-2 bg-primary-light border-primary">
      <i className="text-primary-dark text-18">{icon}</i>
      <span className="font-semibold text-green-900">{text}</span>
    </div>
  );
};
const CategorySelectLanguage = () => {
  const { t } = useTranslation();
  return (
    <>
      <CategoryHeader icon={<MdOutlineLanguage />} text={t("Ngôn ngữ")} />
      <div className="mr-2 ml-4">
        <SelectLanguage mode="desktop" />
      </div>
    </>
  );
};

const CategoryGroup = () => {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      <CategoryHeader icon={<HiOutlineShare />} text={t("Nhóm của sàn")} />
      <div
        onClick={() => {
          router.push("/post/solution-group");
        }}
        className="flex flex-col items-start px-2 w-full h-44 cursor-pointer"
      >
        <img className="w-44" src="/assets/img/logo-solution.png" />
      </div>
    </>
  );
};
