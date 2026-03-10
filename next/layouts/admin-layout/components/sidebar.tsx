import { cloneDeep } from "lodash";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Scrollbars from "react-custom-scrollbars";

import { useTranslation } from "react-i18next";
import { AiOutlineBell } from "react-icons/ai";
import { FaRegCommentDots } from "react-icons/fa";
import { HiOutlineLocationMarker } from "react-icons/hi";
import {
  RiBankLine,
  RiBarChartLine,
  RiCpuLine,
  RiFileList3Line,
  RiKey2Line,
  RiLayoutGridLine,
  RiLayoutTop2Line,
  RiNotification2Line,
  RiQuestionLine,
  RiSettings3Line,
  RiShirtLine,
  RiShoppingCartLine,
  RiTruckLine,
  RiUserLine,
  RiUserSettingsLine,
  RiUserStarLine,
  RiWallet3Line,
} from "react-icons/ri";
import { Button } from "../../../components/shared/utilities/form/button";
import { Accordion } from "../../../components/shared/utilities/misc";
import { Popover } from "../../../components/shared/utilities/popover/popover";
import { SCOPES } from "../../../lib/constants/scopes.const";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAuth } from "../../../lib/providers/auth-provider";
import { UserRoleEnum } from "../../../lib/repo/types";
import { useAdminLayoutContext } from "../providers/admin-layout-provider";
import { Footer } from "./footer";

interface PropsType extends ReactProps {
  onChange: (subMenu: SubMenu) => any;
}
export default function Sidebar({ onChange, ...props }: PropsType) {
  const { SIDEBAR_MENUS } = useSidebarMenuConstants();
  const [menus, setMenus] = useState<any[]>(SIDEBAR_MENUS);
  const router = useRouter();
  const screenXl = useScreen("xl");
  const { pendingRegistrations, setSidebarMenu } = useAdminLayoutContext();
  const { user } = useAuth();
  const titleRef = useRef();
  const toggleMenu = (index) => {
    menus[index].isOpen = !menus[index].isOpen;
    setMenus([...menus]);
  };
  const hasMenu = useMemo(() => !!menus, [menus]);
  useEffect(() => {
    menus.forEach((menu) => {
      if (router.pathname.includes(menu.path)) menu.isOpen = true;
    });
    setMenus([...menus]);
  }, []);

  useEffect(() => {
    let menus = cloneDeep(SIDEBAR_MENUS);
    menus.forEach((menu) => {
      let flag = false;
      menu.submenus.forEach((subMenu) => {
        if (router.pathname.includes(subMenu.path)) flag = true;
        if (subMenu.scope && !user.scopes.includes(subMenu.scope)) subMenu.hidden = true;
        if (subMenu.role && !subMenu.role.includes(user.role)) subMenu.hidden = true;
      });
      if (menu.submenus.length == menu.submenus.filter((x) => x.hidden).length) menu.hidden = true;
    });
    setMenus([...menus]);
    setSidebarMenu([...menus]);
  }, []);

  useEffect(() => {
    if (router.pathname && hasMenu) {
      if (router.pathname === "/admin") {
        for (let menu of menus) {
          if (menu.hidden) continue;
          for (let subMenu of menu.submenus) {
            if (subMenu.hidden) continue;
            menu.isOpen = true;
            setMenus([...menus]);
            router.replace(subMenu.path);
            onChange(subMenu);
            return;
          }
        }
      }
      for (let menu of menus) {
        for (let subMenu of menu.submenus) {
          if (router.pathname === subMenu.path) {
            onChange(subMenu);
            break;
          }
        }
      }
    }
  }, [hasMenu, router.pathname]);
  return (
    <>
      <div
        className={`${screenXl ? "w-60" : "w-24"} fixed flex flex-col z-20 bg-white shadow top-14 `}
        style={{ height: "calc(100vh - 56px)" }}
      >
        <Scrollbars
          hideTracksWhenNotNeeded={true}
          autoHideTimeout={0}
          autoHideDuration={300}
          autoHide
        >
          <div className="py-3">
            {menus
              .filter((x) => !x.hidden)
              .map((menu, index) => (
                <div className="mb-2" key={index}>
                  {screenXl && (
                    <div
                      className={`${screenXl ? "px-4" : "px-2"} flex  py-2 group`}
                      onClick={() => toggleMenu(index)}
                    >
                      {/* <i className="w-5 h-5 text-lg text-primary group-hover:text-primary-dark">
                  {menu.icon}
                </i> */}

                      <span className={`flex-1 px-2 font-semibold uppercase text-primary-dark`}>
                        {menu.title}
                      </span>

                      {/* <i
                        className={`text-lg text-gray-700 group-hover:text-primary self-center transform transition ${
                          menu.isOpen ? "rotate-180" : ""
                        }`}
                      >
                        <RiArrowDownSLine />
                      </i> */}
                    </div>
                  )}

                  <Accordion isOpen={true}>
                    {menu.submenus
                      .filter((x) => !x.hidden)
                      .map((submenu, index) => (
                        <div key={index}>
                          <Button
                            innerRef={titleRef}
                            primary={
                              router.pathname == submenu.path ||
                              router.pathname.includes(`${submenu.path}/`)
                            }
                            className={`w-full pl-8 pr-0 justify-start font-normal rounded-none ${
                              router.pathname.includes(submenu.path) ? "" : "hover:bg-gray-100"
                            }`}
                            icon={submenu.icon}
                            href={submenu.path}
                            // text={
                            //   <div className="flex items-center">
                            //     <span>{submenu.title}</span>
                            //     {!!pendingRegistrations && submenu.showRegistrations && (
                            //       <BadgeShowNumberNoti numberNoti={pendingRegistrations} />
                            //     )}
                            //     {!!pendingGlobalColReg && submenu.showPendingGlobalColReg && (
                            //       <BadgeShowNumberNoti numberNoti={pendingGlobalColReg} />
                            //     )}
                            //   </div>
                            // }

                            text={
                              screenXl && (
                                <div className="flex items-center">
                                  <span>{submenu.title}</span>
                                  {!!pendingRegistrations && submenu.showRegistrations && (
                                    <div
                                      className={`ml-1.5 bg-warning text-white rounded-full px-1 min-w-5 h-5 flex-center text-sm font-bold`}
                                    >
                                      {pendingRegistrations}
                                    </div>
                                  )}
                                </div>
                              )
                            }
                            tooltip={screenXl ? null : submenu.title}

                            // {...(!!pendingRegistrations && submenu.showRegistrations
                            //   ? {
                            //       text: (
                            //         <div className="flex items-center">
                            //           <span>{submenu.title}</span>
                            //           <BadgeShowNumberNoti numberNoti={pendingRegistrations} />
                            //         </div>
                            //       ),
                            //     }
                            //   : !!pendingGlobalCusReg && submenu.showPendingGlobalCusReg
                            //   ? {
                            //       text: (
                            //         <div className="flex items-center">
                            //           <span>{submenu.title}</span>
                            //           <BadgeShowNumberNoti numberNoti={pendingGlobalCusReg} />
                            //         </div>
                            //       ),
                            //     }
                            //   : {
                            //       text: (
                            //         <div className="flex items-center">
                            //           <span>{submenu.title}</span>
                            //         </div>
                            //       ),
                            //     })}
                          ></Button>
                          {!screenXl && (
                            <Popover
                              theme="material"
                              reference={titleRef}
                              trigger="hover"
                              placement="right"
                            >
                              {submenu.title}
                            </Popover>
                          )}
                        </div>
                      ))}
                  </Accordion>
                </div>
              ))}
          </div>
        </Scrollbars>
        <Footer />
      </div>
    </>
  );
}

const BadgeShowNumberNoti = ({ numberNoti }) => {
  return (
    <div
      className={`ml-1.5 bg-warning text-white rounded-full px-1 min-w-5 h-5 flex-center text-sm font-bold`}
    >
      {numberNoti || ""}
    </div>
  );
};

export interface SubMenu {
  title: string;
  path: string;
  scope?: string;
  hidden?: boolean;
  icon?: JSX.Element;
  role?: string[];
  showRegistrations?: boolean;
  showPendingGlobalColReg?: boolean;
}
export interface Menu {
  title: string;
  path?: string;
  icon?: JSX.Element;
  isOpen?: boolean;
  hidden?: boolean;
  submenus?: SubMenu[];
}

const useSidebarMenuConstants = () => {
  const { t } = useTranslation();
  const SIDEBAR_MENUS: Menu[] = [
    {
      title: t("Quản trị"),

      submenus: [
        // {
        //   title: t("Bảng thống kê"),
        //   path: "/admin/management/analytics",
        //   icon: <RiDashboard2Line />,
        //   scope: SCOPES.VIEW_ANALYTIC,
        //   role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        // },
        {
          title: t("Đơn hàng"),
          path: "/admin/management/orders",
          icon: <RiShoppingCartLine />,
          scope: SCOPES.VIEW_ORDER,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },

        {
          title: t("Tài khoản"),
          path: "/admin/management/users",
          icon: <RiUserLine />,
          scope: SCOPES.VIEW_USER,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Sản phẩm"),
          path: "/admin/management/products",
          icon: <RiShirtLine />,
          scope: SCOPES.VIEW_PRODUCT,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Ngành hàng"),
          path: "/admin/management/categories",
          icon: <RiLayoutGridLine />,
          scope: SCOPES.VIEW_CATEGORY,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Khách hàng"),
          path: "/admin/management/customers",
          icon: <RiUserStarLine />,
          scope: SCOPES.VIEW_CUSTOMER,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },

        {
          title: t("Banner"),
          path: "/admin/management/banners",
          icon: <RiLayoutTop2Line />,
          scope: SCOPES.VIEW_BANNER,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Popup thông báo"),
          path: "/admin/management/popup-notify",
          icon: <RiNotification2Line />,
          scope: SCOPES.VIEW_POPUP_NOTIFY,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },

        {
          title: t("Quản lý thông báo"),
          path: "/admin/management/all-notifications",
          icon: <AiOutlineBell />,
          scope: SCOPES.VIEW_NOTIFICATION,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
      ],
    },

    {
      title: t("Tán gẫu"),
      submenus: [
        {
          title: t("Quản lý Chat"),
          path: "/admin/management/threads",
          icon: <FaRegCommentDots />,
          scope: SCOPES.VIEW_THREAD,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Chat của tôi"),
          path: "/admin/management/chats",
          icon: <FaRegCommentDots />,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
      ],
    },

    {
      title: t("Ngân hàng và mPoint"),
      submenus: [
        {
          title: t("Quản lý MPoint"),
          path: "/admin/management/wallets",
          icon: <RiWallet3Line />,
          scope: SCOPES.VIEW_WALLET,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Ngân hàng"),
          path: "/admin/management/banks",
          icon: <RiBankLine />,
          scope: SCOPES.VIEW_BANK,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        // {
        //   title: t("Giao dịch MPoint"),
        //   path: "/admin/management/wallet-transactions",
        //   icon: <RiWallet3Line />,
        //   scope: SCOPES.VIEW_WALLETTRANSACTION,
        //   role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        // },
        // {
        //   title: t("Quản lý rút MPoint"),
        //   path: "/admin/management/wallet-draws",
        //   icon: <RiWallet3Line />,
        //   scope: SCOPES.VIEW_WALLET_DRAW,
        //   role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        // },
      ],
    },
    {
      title: t("Truyền thông"),
      submenus: [
        {
          title: t("Tin tức"),
          path: "/admin/management/posts",
          icon: <RiFileList3Line />,
          scope: SCOPES.VIEW_POST,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Hướng dẫn"),
          path: "/admin/management/trainings",
          icon: <RiQuestionLine />,

          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
      ],
    },
    {
      title: t("Cấu hình sàn"),
      submenus: [
        {
          title: t("Thông báo của tôi"),
          path: "/admin/management/notifications",
          icon: <AiOutlineBell />,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },

        {
          title: t("Phân quyền"),
          path: "/admin/management/authoritys",
          icon: <RiUserSettingsLine />,
          scope: SCOPES.VIEW_AUTHORITY,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Báo cáo"),
          path: "/admin/management/reports",
          icon: <RiBarChartLine />,
          scope: SCOPES.VIEW_AUTHORITY,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Cấu hình hệ thống"),
          path: "/admin/management/settings",
          icon: <RiSettings3Line />,
          scope: SCOPES.VIEW_CONFIG,
          role: [UserRoleEnum.ADMIN],
        },
        {
          title: "Quản lý chứng chỉ",
          path: "/admin/management/credentials",
          icon: <RiKey2Line />,
          scope: SCOPES.VIEW_CREDENTIAL,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Nhà cung cấp vận chuyển"),
          path: "/admin/management/shipping-providers",
          icon: <RiTruckLine />,
          scope: SCOPES.VIEW_SHIPPING_PROVIDER,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Nhà cung cấp AI"),
          path: "/admin/management/ai-provider",
          icon: <RiCpuLine />,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
        {
          title: t("Địa chỉ cửa hàng  "),
          path: "/admin/management/shop-address",
          icon: <HiOutlineLocationMarker />,
          scope: SCOPES.VIEW_PRODUCT,
          role: [UserRoleEnum.STAFF, UserRoleEnum.ADMIN],
        },
      ],
    },
  ];

  return { SIDEBAR_MENUS };
};
