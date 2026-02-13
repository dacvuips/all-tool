import Link from "next/link";
import { useRouter } from "next/router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AiOutlineBell, AiOutlineSearch } from "react-icons/ai";
import { FiShoppingCart } from "react-icons/fi";
import { HiArrowLeft, HiOutlineCheck, HiOutlineChevronDown } from "react-icons/hi";
import {
  RiArrowLeftSLine,
  RiBankCardLine,
  RiHandCoinFill,
  RiLockPasswordLine,
  RiLogoutBoxLine,
  RiMenu3Line,
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
import { NOTIFY_FRAGMENT, NotificationService } from "../lib/repo/notification/notification.repo";

import { useCheckoutContext } from "../components/index/checkout/provider/checkout-provider";
import { CartDropdown as CartDropdownComponent } from "../components/shared/cart/cart-dropdown";
import { Order } from "../lib/repo";
import { CardMenu } from "./home-layout/components/card-menu";
import { HomePageDeactiveDialog } from "./home-layout/components/home-page-deactive-dialog";

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

  const { HEADER_DROPDOWN_MENUS } = useHeaderDropDownMenus();
  const { setOpenCustomerLoginDialog } = useGlobalContext();

  return (
    <>
      {/* {!isBlockPage && <HomePopupNotify />} */}
      {/* <RewardPointNotifyDialog /> */}
      <HomePageDeactiveDialog isOpen={!!isBlockPage} pageDeactiveDialogValue={isBlockPage?.value} />
      <header className="fixed top-0 left-0 z-50 flex items-center w-full bg-white shadow h-14">
        <div className="w-full bg-white">
          <div className="flex flex-row items-center justify-between w-full pl-5 pr-1 h-14">
            <div className="flex flex-row items-center justify-around">
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
            <div className="flex flex-row items-center justify-around">
              <nav className="min-h-15">
                <div className="flex flex-row items-center justify-between py-3">
                  <div className="flex flex-row items-center flex-grow-0 flex-shrink-0 gap-2">
                    <SelectLanguage mode="desktop" />

                    <CartDropdown order={order} />

                    {customer && <NotifiCationDropdown />}

                    <div className="mr-3" ref={userRef}>
                      {!customer ? (
                        <>
                          <Button
                            small
                            text={t("Đăng nhập/Đăng ký")}
                            className="font-semibold leading-6 rounded-full cursor-pointer whitespace-nowrap"
                            onClick={() => setOpenCustomerLoginDialog(true)}
                            primary
                          />
                        </>
                      ) : (
                        <div className="cursor-pointer">
                          <div className="flex items-center justify-between gap-1">
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
                      className="border-b h-14"
                    >
                      <div className="flex items-center justify-between gap-1 pb-2 overflow-ellipsis">
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
                            <RiHandCoinFill className="ml-1 mr-2 text-yellow-400" />
                            {/* {currencyPrice(wallet?.balance) || 0} {" MPoint"} */}
                          </div>
                          <div className="flex flex-row items-center font-semibold">
                            <RiUserHeartFill className="ml-1 mr-2 text-yellow-400" />
                            {customer?.creditPoint || 0} {`/100 ${t("uy tín")}`}
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
  const [openMenu, setOpenMenu] = useState(false);

  const [isMobileSearchBox, setIsMobileSearchBox] = useState(false);
  const isBlockPage = useSettingPublic("pa-b-page");

  const isMainPage = !name;

  const { setOpenCustomerLoginDialog, postPopup } = useGlobalContext();

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
        <div className="fixed top-0 left-0 z-50 flex flex-row items-center w-full bg-white shadow h-14">
          <div className="flex flex-row justify-between w-full gap-2 px-4">
            <div className="flex flex-row items-center">
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
              <div className="flex flex-row items-center justify-between gap-4">
                <div className="flex flex-row items-center gap-2">
                  {screenMd ? (
                    <>
                      <SelectLanguage mode="mobile" />
                    </>
                  ) : (
                    <>
                      <i
                        onClick={() => setIsMobileSearchBox(true)}
                        className="p-1.5 leading-3 border rounded-full border-primary cursor-pointer"
                      >
                        <AiOutlineSearch />
                      </i>
                    </>
                  )}

                  <CartDropdown order={order} />
                  {customer && <NotifiCationDropdown />}
                  <Button
                    className="px-2"
                    onClick={() => setOpenMenu(true)}
                    icon={<RiMenu3Line />}
                    iconClassName="text-xl"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </>

      <CardMenu isOpen={openMenu} onClose={() => setOpenMenu(false)} />
      <OrderNotify order={order} />
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
          <Img className="w-4 h-4 leading-3 border rounded-full" src={selectLocale.image} />
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
          className="px-1 font-semibold border rounded-full cursor-pointer whitespace-nowrap"
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
              <Img className="w-5 h-5 border rounded-full" src={locale.image} />
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
      <div className="w-full my-2"></div>
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
          <div className="absolute top-0 px-1 text-xs font-semibold text-white bg-red-500 rounded-full left-5">
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
        <div className="absolute top-0 px-1 text-xs font-semibold text-white bg-red-500 rounded-full left-5">
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

const useHeaderDropDownMenus = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const { setOpenChangePasswordDialog } = useGlobalContext();
  const { logoutCustomer } = useAuth();

  const HEADER_DROPDOWN_MENUS = [
    {
      text: t("Nạp ví"),
      icon: <RiBankCardLine />,
      onclick: () => router.push("/profile/deposit"),
    },
    {
      text: t("Đơn mua"),
      icon: <RiShoppingCart2Line />,
      onclick: () => router.push("/profile/orders-buy"),
    },
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
      {!!order && (
        <div
          className="fixed bottom-0 left-0 z-50 flex items-center justify-center w-full h-10 text-sm font-medium text-yellow-800 bg-yellow-100 cursor-pointer"
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
