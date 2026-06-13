import Link from "next/link";
import { useRouter } from "next/router";
import { ReactElement, useCallback, useEffect, useState } from "react";
import { Scrollbars } from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import { HiOutlineShare, HiOutlineX } from "react-icons/hi";
import { MdOutlineLanguage } from "react-icons/md";
import {
  RiArrowRightSLine,
  RiBookOpenLine,
  RiCustomerService2Line,
  RiFileList2Line,
  RiHome5Line,
  RiKey2Line,
  RiLoginBoxLine,
  RiLogoutBoxRLine,
  RiPriceTag3Line,
  RiQuestionLine,
  RiShoppingCart2Line,
  RiUser3Line,
  RiVideoLine,
} from "react-icons/ri";

import {
  getPackageStyle,
  GooglePackagePopoverContent,
} from "../../../components/admin/management/customer/components/customer-google-package-cell";
import { SettingsModal } from "../../../components/app/affiliate-video/single/sibar/text-to-video-modal";
import { Slideout, SlideoutProps } from "../../../components/shared/utilities/dialog/slideout";
import { Button } from "../../../components/shared/utilities/form";
import { Img } from "../../../components/shared/utilities/misc";
import { useAlert } from "../../../lib/providers/alert-provider";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { useToast } from "../../../lib/providers/toast-provider";
import { credentialCustomerService } from "../../../lib/repo";
import { SubscriptionPlanEnum } from "../../../lib/repo/customer/customer.repo";
import { AiProviderKeyEnum } from "../../../lib/repo/product/productApp.repo";
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

  /* ─── Credential state (for API Key) ─── */
  const [showSettings, setShowSettings] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);

  const checkCredential = useCallback(async () => {
    try {
      const cred = await credentialCustomerService.getCredentialByKey(
        AiProviderKeyEnum.GOOGLE_GEMINI_KEY
      );
      if (cred) {
        setCredentialId(cred.id || null);
        setCredentialActive(!!cred.active);
      } else {
        setCredentialId(null);
        setCredentialActive(false);
      }
    } catch {
      setCredentialId(null);
      setCredentialActive(false);
    }
  }, [customer]);

  useEffect(() => {
    if (customer) checkCredential();
  }, [checkCredential]);

  const hasKey = !!credentialId;
  const keyReady = hasKey && credentialActive;

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
        className="top-14"
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

          {/* ── AI Tools & Package Info Section ── */}
          {customer && (
            <AIToolsSection
              customer={customer}
              keyReady={keyReady}
              onApiKeyClick={() =>
                !customer ? setOpenCustomerLoginDialog(true) : setShowSettings(true)
              }
              onClose={props.onClose}
            />
          )}

          <Category onClose={props.onClose} />
          <CategorySelectLanguage />
          {/* <CategoryGroup /> */}
        </Scrollbars>
      </Slideout>

      {/* ── Settings Modal ── */}
      {showSettings && (
        <SettingsModal
          credentialId={credentialId}
          credentialActive={credentialActive}
          onClose={() => setShowSettings(false)}
          onCredentialChange={checkCredential}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════
   AI Tools & Package Usage Section
   ═══════════════════════════════════════════════════════════ */
function AIToolsSection({
  customer,
  keyReady,
  onApiKeyClick,
  onClose,
}: {
  customer: any;
  keyReady: boolean;
  onApiKeyClick: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  const pkg = customer?.googlePackage;
  const subscription = pkg?.subscription || SubscriptionPlanEnum.FREE;
  const packageStyle = getPackageStyle(subscription);

  const QUICK_ACTIONS = [
    {
      label: t("Hướng dẫn"),
      icon: <RiBookOpenLine />,
      gradient: "linear-gradient(135deg, #3B82F6, #2563EB)",
      onClick: () => {
        onClose();
        router.push("/post");
      },
    },
    {
      label: t("Bảng giá"),
      icon: <RiPriceTag3Line />,
      gradient: "linear-gradient(135deg, #F59E0B, #D97706)",
      onClick: () => {
        onClose();
        router.push("/app/affiliate-video/pricing");
      },
    },
    {
      label: t("API Key"),
      icon: <RiKey2Line />,
      gradient: keyReady
        ? "linear-gradient(135deg, #10B981, #059669)"
        : "linear-gradient(135deg, #9CA3AF, #6B7280)",
      onClick: () => {
        onApiKeyClick();
      },
      badge: keyReady ? t("Đã kích hoạt") : t("Chưa kích hoạt"),
      badgeColor: keyReady ? "#059669" : "#9CA3AF",
    },
  ];

  return (
    <div className="px-3 mt-4">
      {/* ── Section Header ── */}
      <div
        className={`flex gap-2 items-center px-1 mb-3 border-l-[3px] pl-2 ${packageStyle.border}`}
      >
        <span className={`text-sm font-bold ${packageStyle.text}`}>
          {t("AI Tools & Gói dịch vụ")}
        </span>
      </div>

      {/* ── Package Details Card ── */}
      <GooglePackagePopoverContent googlePackage={pkg} />

      {/* ── Quick Action Buttons ── */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        {QUICK_ACTIONS.map((action, idx) => (
          <button
            key={idx}
            onClick={action.onClick}
            className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-gray-100 bg-white group"
            style={{
              transition: "all 0.2s ease",
              boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              e.currentTarget.style.transform = "translateY(-1px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <div
              className="flex justify-center items-center text-white rounded-lg"
              style={{
                width: "32px",
                height: "32px",
                background: action.gradient,
                fontSize: "16px",
                transition: "transform 0.2s ease",
              }}
            >
              {action.icon}
            </div>
            <span className="text-xs font-semibold leading-tight text-gray-700 whitespace-nowrap">
              {action.label}
            </span>
            {action.badge && (
              <span
                className="text-xs font-medium px-1.5 py-0.5 rounded-full leading-none"
                style={{
                  fontSize: "9px",
                  color: "white",
                  background: action.badgeColor,
                }}
              >
                {action.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
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
