import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineBell } from "react-icons/ai";
import { FiShoppingCart } from "react-icons/fi";
import { HiArrowLeft, HiOutlineCheck, HiOutlineChevronDown } from "react-icons/hi";
import {
  RiArrowLeftSLine,
  RiBankCardLine,
  RiBookOpenLine,
  RiHandCoinFill,
  RiKey2Line,
  RiLockPasswordLine,
  RiLogoutBoxLine,
  RiMenu3Line,
  RiPriceTag3Line,
  RiShoppingCart2Line,
  RiUserHeartFill,
} from "react-icons/ri";

import { VideoDialog } from "../components/shared/common/video-dialog";
import { Button } from "../components/shared/utilities/form";
import { Img } from "../components/shared/utilities/misc";
import { Dropdown } from "../components/shared/utilities/popover/dropdown";
import { Popover } from "../components/shared/utilities/popover/popover";
import { useOptionsTranslation } from "../lib/hooks/useOptionsTranslate";
import { useScreen } from "../lib/hooks/useScreen";
import { useSettingPublic } from "../lib/hooks/useSettingPublic";
import { useAuth } from "../lib/providers/auth-provider";
import { useCart } from "../lib/providers/cart-provider";
import { useGlobalContext } from "../lib/providers/global-provider";
import { useLocale } from "../lib/providers/locale-provider";

import { Pagination, QueryInput } from "../lib/repo/crud.repo";
import { NotificationService, NOTIFY_FRAGMENT } from "../lib/repo/notification/notification.repo";

import { SettingsModal } from "../components/app/affiliate-video/sibar/text-to-video-modal";
import { useCheckoutContext } from "../components/index/checkout/provider/checkout-provider";
import { CartDropdown as CartDropdownComponent } from "../components/shared/cart/cart-dropdown";
import { parseNumber } from "../lib/helpers/parser";
import { credentialCustomerService, Order, PaymentStatus } from "../lib/repo";
import { AiProviderKeyEnum } from "../lib/repo/product/productApp.repo";
import { CardMenu } from "./home-layout/components/card-menu";
import { HomePageDeactiveDialog } from "./home-layout/components/home-page-deactive-dialog";
import { useHomeLayoutContext } from "./home-layout/provider/home-layout-provider";

export interface HeaderProps extends ReactProps {
  shopCode?: string;
  name?: string;
  order?: Order;
}

export function DefaultHeader({ shopCode, name, ...props }: HeaderProps) {
  const screenLg = useScreen("lg");
  const { order } = useCheckoutContext();

  return screenLg ? (
    <DesktopHeader name={name} order={order} />
  ) : (
    <MobileHeader name={name} order={order} />
  );
}

function DesktopHeader({ shopCode, order, ...props }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const userRef = useRef();
  const isBlockPage = useSettingPublic("pa-b-page");
  const [openTrainingByVideoDialog, setOpenTrainingByVideoDialog] = useState<string>(null);
  const { customer } = useAuth();
  const { wallet } = useHomeLayoutContext();

  const { HEADER_DROPDOWN_MENUS } = useHeaderDropDownMenus();
  const { setOpenCustomerLoginDialog, setOpenSidebarSlideout } = useGlobalContext();
  const screenXl = useScreen("xl");
  const isHomePage = router.pathname === "/";

  /* ─── Credential state (for affiliate-video API Key button) ─── */
  const [showSettings, setShowSettings] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);

  const checkCredential = useCallback(async () => {
    setCredentialLoading(true);
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
    } finally {
      setCredentialLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  const hasKey = !!credentialId;
  const keyReady = hasKey && credentialActive;

  return (
    <>
      {/* {!isBlockPage && <HomePopupNotify />} */}
      {/* <RewardPointNotifyDialog /> */}
      <HomePageDeactiveDialog isOpen={!!isBlockPage} pageDeactiveDialogValue={isBlockPage?.value} />
      <header className="flex fixed top-0 left-0 z-50 items-center w-full h-14 bg-white shadow">
        <div className="w-full bg-white">
          <div className="flex flex-row justify-between items-center pr-1 pl-5 w-full h-14">
            <div className="flex flex-row justify-around items-center">
              {!screenXl && isHomePage && (
                <div className="pr-3 mr-1">
                  <Button
                    outline
                    tooltip={t("Danh mục")}
                    small
                    icon={<RiMenu3Line />}
                    className="p-0 w-8 h-8 text-xl rounded-md text-primary"
                    onClick={() => setOpenSidebarSlideout?.(true)}
                  />
                </div>
              )}
              <div className="mr-6 logo min-w-12">
                <Link href={"/"}>
                  <img
                    src={"/assets/img/logo-new.png"}
                    className="object-contain min-w-28 sm:w-20 lg:w-36"
                    alt="logo"
                  />
                </Link>
              </div>
            </div>

            {/* ── Affiliate Video: Right side actions ── */}
            {customer && (
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
                {/* Hướng dẫn */}
                <Button
                  outline
                  className="px-2 h-8 rounded-md"
                  icon={<RiBookOpenLine className="text-xs" />}
                  text={t("Hướng dẫn")}
                />{" "}
                {/* Bảng giá */}
                <Button
                  outline
                  className="px-2 h-8 rounded-md"
                  icon={<RiPriceTag3Line className="text-xs" />}
                  text={t("Bảng giá")}
                  href="/pricing"
                />
                {/* API Key status */}
                <Button
                  onClick={() =>
                    !customer ? setOpenCustomerLoginDialog(true) : setShowSettings(true)
                  }
                  outline
                  className="px-2 h-8 rounded-md"
                  success={keyReady}
                  gray={!keyReady}
                  icon={<RiKey2Line className="text-xs" />}
                  asyncLoading={false}
                  text={t("API Key")}
                />{" "}
                <PackageUsageQuota />
              </div>
            )}
            <div className="flex flex-row justify-around items-center">
              <nav className="min-h-15">
                <div className="flex flex-row justify-between items-center py-3">
                  <div className="flex flex-row flex-grow-0 flex-shrink-0 gap-2 items-center">
                    <SelectLanguage mode="desktop" />

                    <CartDropdown order={order} />

                    {customer && <NotifiCationDropdown />}

                    <div className="mr-3" ref={userRef}>
                      {!customer ? (
                        <>
                          <Button
                            small
                            text={t("Đăng nhập/Đăng ký")}
                            className="font-semibold leading-6 whitespace-nowrap rounded-full cursor-pointer"
                            onClick={() => setOpenCustomerLoginDialog(true)}
                            primary
                          />
                        </>
                      ) : (
                        <div className="cursor-pointer">
                          <div className="flex gap-1 justify-between items-center">
                            <Img
                              src={customer?.avatarUrl}
                              imageClassName="border-primary-dark border hover:border-orange"
                              className="ml-2 w-9"
                              avatar
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {customer && (
                  <Dropdown reference={userRef} trigger="hover" placement="bottom-start" arrow>
                    <Dropdown.Item
                      onClick={() => router.push("/profile")}
                      className="h-14 border-b"
                    >
                      <div className="flex gap-1 justify-between items-center pb-2 overflow-ellipsis">
                        <Img
                          imageClassName="border-primary-dark border hover:border-orange"
                          src={customer?.avatarUrl}
                          className="w-11"
                          avatar
                        />
                        <div className="text-sm text-black">
                          <div className="font-semibold text-primary max-w-2xs text-ellipsis">
                            {customer?.name}
                          </div>
                          <div className="flex flex-row items-center font-semibold">
                            <RiHandCoinFill className="mr-2 ml-1 text-yellow-400" />
                            {parseNumber(wallet?.balance) || 0} {" MPoint"}
                          </div>
                          <div className="flex flex-row items-center font-semibold">
                            <RiUserHeartFill className="mr-2 ml-1 text-yellow-400" />
                            {parseNumber(customer?.creditBalance) || 0} {t("Credit")}
                          </div>
                        </div>
                      </div>
                    </Dropdown.Item>
                    {HEADER_DROPDOWN_MENUS.map((item, index) => (
                      <Dropdown.Item
                        key={index}
                        hoverAccent
                        text={item.text}
                        onClick={item.onclick}
                        icon={item.icon}
                      />
                    ))}
                  </Dropdown>
                )}
              </nav>
            </div>
          </div>
        </div>
        <OrderNotify order={order} />
        <VideoDialog
          videoUrl={openTrainingByVideoDialog}
          onClose={() => setOpenTrainingByVideoDialog("")}
          isOpen={!!openTrainingByVideoDialog}
        ></VideoDialog>
      </header>

      {/* ── Affiliate Video: Settings Modal ── */}
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

function MobileHeader({ name, order, ...props }: HeaderProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const screenLg = useScreen("lg");
  const screenMd = useScreen("md");
  const screenXs = useScreen("xs");

  const { customer } = useAuth();
  const [isMobileSearchBox, setIsMobileSearchBox] = useState(false);
  const isBlockPage = useSettingPublic("pa-b-page");

  const isMainPage = !name;
  const isHomePage = router.pathname === "/";

  const {
    setOpenCustomerLoginDialog,
    postPopup,
    openCardMenu,
    setOpenCardMenu,
    setOpenSidebarSlideout,
  } = useGlobalContext();

  /* ─── Credential state (for affiliate-video API Key button) ─── */
  const [showSettings, setShowSettings] = useState(false);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [credentialActive, setCredentialActive] = useState(false);
  const [credentialLoading, setCredentialLoading] = useState(true);

  const checkCredential = useCallback(async () => {
    setCredentialLoading(true);
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
    } finally {
      setCredentialLoading(false);
    }
  }, [customer]);

  useEffect(() => {
    checkCredential();
  }, [checkCredential]);

  const hasKey = !!credentialId;
  const keyReady = hasKey && credentialActive;

  return (
    <>
      {!screenLg && !!isBlockPage && (
        <HomePageDeactiveDialog
          isOpen={!!isBlockPage}
          pageDeactiveDialogValue={isBlockPage?.value}
        />
      )}
      {!isMainPage && (
        <>
          <header className={`sticky top-0 z-10 w-full`}>
            <div className={`flex flex-row items-center mx-auto w-full h-14 bg-white rounded-md`}>
              <Button
                icon={<RiArrowLeftSLine />}
                hoverWhite={isMainPage}
                textAccent={!isMainPage}
                className={`px-1 h-full text-2xl ${isMainPage ? "text-gray-100" : ""}`}
                href={"/profile"}
              />
              <div className="text-base font-bold text-accent">{name}</div>
            </div>
          </header>
        </>
      )}

      <>
        <div className="flex fixed top-0 left-0 z-50 flex-row items-center w-full h-14 bg-white shadow">
          <div className="flex flex-row gap-2 justify-between px-4 w-full">
            <div className="flex flex-row gap-2 items-center">
              <Link href="/" className="block">
                <img
                  src={`${screenXs ? "/assets/img/logo-new.png" : "/assets/img/logo-vuong.png"}`}
                  className="object-contain w-14 h-14 min-w-14 xs:min-w-36 xs:w-36"
                />
              </Link>
            </div>
            {isMobileSearchBox && !screenMd ? (
              <SearchInputMobile setIsMobileSearchBox={setIsMobileSearchBox} />
            ) : (
              <div className="flex flex-row gap-4 justify-between items-center">
                <div className="flex flex-row gap-2 items-center">
                  {screenMd ? (
                    <>
                      <SelectLanguage mode="mobile" />
                    </>
                  ) : (
                    <></>
                  )}

                  {/* Affiliate Video: API Key status (mobile) */}
                  {
                    <Button
                      onClick={() =>
                        !customer ? setOpenCustomerLoginDialog(true) : setShowSettings(true)
                      }
                      outline
                      className="px-2 h-8 rounded-md"
                      success={keyReady}
                      gray={!keyReady}
                      icon={<RiKey2Line className="text-xs" />}
                      asyncLoading={false}
                      text={t("API Key")}
                    />
                  }

                  <CartDropdown order={order} />
                  {customer && <NotifiCationDropdown />}
                  <Button
                    className="px-2"
                    onClick={() => setOpenCardMenu?.(true)}
                    icon={<RiMenu3Line />}
                    iconClassName="text-xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </>

      <CardMenu isOpen={!!openCardMenu} onClose={() => setOpenCardMenu?.(false)} />
      <OrderNotify order={order} />

      {/* ── Affiliate Video: Settings Modal (mobile) ── */}
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

export const SelectLanguage = ({
  mode,
  isDashboard,
}: {
  mode: "mobile" | "desktop";
  isDashboard?: boolean;
}) => {
  const languageRef = useRef();
  const { changeLocale, currentLocale } = useLocale();
  const { LOCALES } = useOptionsTranslation();

  const selectLocale = LOCALES.find((item) => item.value === currentLocale);

  return (
    <>
      {mode === "mobile" ? (
        <div
          ref={languageRef}
          className={`p-1.5 leading-3 rounded-full  cursor-pointer ${
            !isDashboard
              ? "border-primary border"
              : "h-8 w-8 flex items-center justify-center hover:bg-gray-100 text-xl text-gray-600"
          }`}
        >
          <Img className="w-4 h-4 leading-3 rounded-full border" src={selectLocale.image} />
        </div>
      ) : (
        <Button
          innerRef={languageRef}
          small
          text={
            <>
              <span>{selectLocale.label}</span>
              <i className="text-14">
                <HiOutlineChevronDown />
              </i>
            </>
          }
          className="px-1 font-semibold whitespace-nowrap rounded-full border cursor-pointer"
          icon={<Img className="w-4 h-4 leading-3" src={selectLocale.image} />}
          iconClassName="text-20"
          outline
          primary
        />
      )}

      <Popover reference={languageRef} trigger="hover" placement="bottom" arrow>
        {LOCALES.map((locale) => {
          return (
            <div
              key={locale.value}
              onClick={() => {
                changeLocale(locale.value);
              }}
              className="flex items-center gap-2 p-1.5 cursor-pointer  hover:bg-primary-light rounded-md"
            >
              <Img className="w-5 h-5 rounded-full border" src={locale.image} />
              <span>{locale.label}</span>
              {currentLocale === locale.value && (
                <i className="text-success">
                  <HiOutlineCheck />
                </i>
              )}
            </div>
          );
        })}
      </Popover>
    </>
  );
};
function SearchInputMobile({
  setIsMobileSearchBox,
}: {
  setIsMobileSearchBox?: (value: boolean) => void;
}) {
  const xs = useScreen("xs");
  return (
    <div className={`flex items-center justify-end  gap-2 ${xs ? "w-full" : "w-48"}`}>
      <i
        onClick={() => setIsMobileSearchBox(false)}
        className="p-1.5 leading-3 border rounded-full border-primary cursor-pointer"
      >
        <HiArrowLeft />
      </i>
      <div className="my-2 w-full"></div>
    </div>
  );
}
function CartDropdown({ order }: { order?: Order }) {
  const cartRef = useRef();
  const [isOpen, setIsOpen] = useState(false);
  const { cartCount } = useCart();

  const orderCount = order ? 1 : 0;
  const badgeCount = cartCount + orderCount;
  return (
    <>
      <div className={`relative mr-2`} ref={cartRef}>
        <Button
          icon={<FiShoppingCart />}
          iconClassName="text-black"
          className="px-0 font-semibold text-24"
          onClick={() => setIsOpen(!isOpen)}
        />
        {badgeCount > 0 && (
          <div className="absolute top-0 left-5 px-1 text-xs font-semibold text-white bg-red-500 rounded-full">
            {badgeCount > 99 ? "99+" : badgeCount}
          </div>
        )}
      </div>

      {isOpen && (
        <div className="fixed top-0 right-0 z-50 lg:absolute lg:top-full lg:right-0">
          <CartDropdownComponent
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            anchorRef={cartRef}
          />
        </div>
      )}
    </>
  );
}

export function NotifiCationDropdown() {
  const refNotification = useRef();
  const { customer } = useAuth();
  const router = useRouter();
  const { notificationCount } = useGlobalContext();
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
    return NotificationService.getCustomerNotification({
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
  }, [customer, router.pathname]);
  return (
    <div className="relative">
      <Button
        icon={<AiOutlineBell />}
        iconClassName="text-black"
        className="px-0 font-semibold text-28"
        innerRef={refNotification}
      />
      {!!notificationCount && (
        <div className="absolute top-0 left-5 px-1 text-xs font-semibold text-white bg-red-500 rounded-full">
          {notificationCount >= 9 ? "9+" : notificationCount}
        </div>
      )}
      <Popover
        reference={refNotification}
        trigger="click"
        placement="bottom-end"
        hideOnClickOutside={false}
      ></Popover>
    </div>
  );
}

function PackageUsageQuota() {
  const { t } = useTranslation();
  const { customer } = useAuth();

  return (
    <div className="flex items-center h-8 border border-gray-300 rounded-full bg-gray-50 overflow-hidden text-sm mr-2">
      <span className="px-2.5 text-gray-700 font-semibold  whitespace-nowrap border-r border-gray-300">
        {t("Gói")}:{" "}
        <span className="text-gray-900">
          {customer?.googlePackage?.subscription || t("Dùng thử")}
        </span>
      </span>
      <span className="px-2.5 text-gray-600 whitespace-nowrap border-r border-gray-300">
        Video:{" "}
        <span className="font-semibold  text-gray-900">
          {customer?.googlePackage?.videoCount ?? 0}
        </span>
        <span className="text-gray-400"> /{customer?.googlePackage?.videoLimit ?? 0}</span>
      </span>
      <span className="px-2.5 text-gray-600 whitespace-nowrap">
        {t("Ảnh")}:{" "}
        <span className="font-semibold   text-gray-900">
          {customer?.googlePackage?.imageCount ?? 0}
        </span>
        <span className="text-gray-400"> /{customer?.googlePackage?.imageLimit ?? 0}</span>
      </span>
    </div>
  );
}

const useHeaderDropDownMenus = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { setOpenChangePasswordDialog } = useGlobalContext();
  const { logoutCustomer } = useAuth();

  const HEADER_DROPDOWN_MENUS = [
    {
      text: t("Nạp ví"),
      icon: <RiBankCardLine />,
      onclick: () => router.push("/checkout"),
    },
    {
      text: t("Đơn mua"),
      icon: <RiShoppingCart2Line />,
      onclick: () => router.push("/profile/orders-buy"),
    },
    // {
    //   text: t("API Key"),
    //   icon: <RiKey2Line />,
    //   onclick: () => router.push("/profile/credential"),
    // },
    // {
    //   text: t("Đơn trung gian bán"),
    //   icon: <RiHandCoinLine />,
    //   onclick: () => router.push("/profile/orders-sell"),
    // },

    {
      text: t("Đổi mật khẩu"),
      icon: <RiLockPasswordLine />,
      onclick: async () => await setOpenChangePasswordDialog(true),
    },
    {
      text: t("Đăng xuất"),
      icon: <RiLogoutBoxLine />,
      onclick: async () => {
        await logoutCustomer();
      },
    },
  ];
  return { HEADER_DROPDOWN_MENUS };
};

const OrderNotify = ({ order }: { order?: Order }) => {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <>
      {!!order && order.paymentStatus !== PaymentStatus.PAYMENT_INITIATED && (
        <div
          className="flex fixed bottom-0 left-0 z-50 justify-center items-center w-full h-10 text-sm font-medium text-yellow-800 bg-yellow-100 cursor-pointer"
          onClick={() => router.push(`/checkout`)}
        >
          <span>
            {t("Bạn có đơn chờ thanh toán")}:{" "}
            <Link href={`/checkout`} className="font-semibold text-primary">
              {order?.orderNumber}
            </Link>{" "}
            {t("Click !")}
          </span>
        </div>
      )}
    </>
  );
};
