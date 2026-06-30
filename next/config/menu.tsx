import {
  RiArrowLeftRightFill,
  RiBankLine,
  RiBillLine,
  RiGamepadLine,
  RiLayoutTop2Line,
  RiLoader4Line,
  RiPlantLine,
  RiSettings3Line,
  RiShoppingBag3Line,
  RiTodoLine,
  RiUser2Line,
  RiUser5Line,
  RiUserSettingsLine,
  RiUserStarFill,
} from "react-icons/ri";
import { SCOPES } from "../lib/constants/scopes.const";

export const ADMIN_SIDEBAR_MENUS = [
  {
    title: "Quản trị",

    submenus: [
      // {
      //   title: "Bảng điều khiển",
      //   path: "/admin/management/dashboard",
      //   icon: <RiDashboard2Line />,
      // },
      {
        title: "Tài khoản",
        path: "/admin/management/users",
        icon: <RiUser2Line />,
        scope: SCOPES.VIEW_USER,
      },
      {
        title: "Khách hàng",
        path: "/admin/management/customers",
        icon: <RiUserStarFill />,
      },
      {
        title: "Cửa hàng",
        path: "/admin/management/shops",
        icon: <RiUserStarFill />,
      },
      {
        title: "Phân quyền",
        path: "/admin/management/authoritys",
        icon: <RiUserSettingsLine />,
        // scope: SCOPES.VIEW_AUTHORITY,
      },
      {
        title: "Cấu hình hệ thống",
        path: "/admin/management/settings",
        icon: <RiSettings3Line />,
      },
      {
        title: "Banner",
        path: "/admin/management/banners",
        icon: <RiLayoutTop2Line />,
      },
      {
        title: "Danh mục",
        path: "/admin/management/games",
        icon: <RiGamepadLine />,
      },
      {
        title: "Sản phẩm Shop",
        path: "/admin/management/shop-products",
        icon: <RiShoppingBag3Line />,
      },
      {
        title: "Đơn giao dịch",
        path: "/admin/management/game-orders",
        icon: <RiArrowLeftRightFill />,
      },
      {
        title: "Ngân hàng đã xác thực",
        path: "/admin/management/bank-verifieds",
        icon: <RiBankLine />,
      },
      {
        title: "Quản lý Job",
        path: "/admin/management/jobs",
        icon: <RiLoader4Line />,
      },
    ],
  },
  {
    title: "Thẻ",
    submenus: [
      {
        title: "Nhà cung cấp",
        path: "/admin/management/suppliers",
        icon: <RiUser5Line />,
      },
      {
        title: "Sản phẩm",
        path: "/admin/management/products",
        icon: <RiPlantLine />,
      },
      {
        title: "Ngân hàng",
        path: "/admin/management/banks",
        icon: <RiBankLine />,
      },
      {
        title: "Đơn hàng",
        path: "/admin/management/orders",
        icon: <RiBillLine />,
      },
      {
        title: "Danh sách thẻ",
        path: "/admin/management/game-cards",
        icon: <RiTodoLine />,
      },
    ],
  },
  {
    title: "Bán hàng",
    submenus: [
      // {
      //   title: "Báo cáo",
      //   path: "/admin/list/reports",
      //   icon: <RiSlideshowLine />,
      // },
    ],
  },
];
