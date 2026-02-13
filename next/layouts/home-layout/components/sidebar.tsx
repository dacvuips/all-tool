import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Scrollbars from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import { HiOutlineShare } from "react-icons/hi";
import {
  RiArrowRightSFill,
  RiArrowUpLine,
  RiEdit2Line,
  RiGamepadLine,
  RiMagicLine,
  RiShoppingBag3Line,
  RiStore2Line,
  RiUserAddLine,
} from "react-icons/ri";
import { SidebarToggleButton } from "../../../components/shared/common/sidebar-toggle-button";
import { Dialog } from "../../../components/shared/utilities/dialog/dialog";
import { Button } from "../../../components/shared/utilities/form/button";
import { Popover } from "../../../components/shared/utilities/popover/popover";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import { GameTypeEnum } from "../../../lib/repo/types";
import { Category } from "./category";
import { PostPopup } from "./post-popup";

interface PropsType extends ReactProps {
  getStorage?: string;
  setToggleSidebar?: (value: boolean) => any;
  toggleSidebar?: boolean;
}
export function Sidebar({
  setGetToggleSidebar,
  ...props
}: {
  setGetToggleSidebar?: (value: string) => any;
}) {
  const screenXl = useScreen("xl");
  const [toggleSidebar, setToggleSidebar] = useState<boolean>();
  const [getStorage, setGetStorage] = useState<string>();

  useEffect(() => {
    if (toggleSidebar == true || localStorage.getItem("hiddenSidebar") == null) {
      localStorage.setItem("hiddenSidebar", JSON.stringify(true));
      return;
    }
    if (toggleSidebar == false) {
      localStorage.setItem("hiddenSidebar", JSON.stringify(false));
      return;
    }
  }, [toggleSidebar]);

  useEffect(() => {
    setGetStorage(localStorage.getItem("hiddenSidebar"));
    setGetToggleSidebar(localStorage.getItem("hiddenSidebar"));
  }, [toggleSidebar]);

  if (screenXl && getStorage == "true")
    return (
      <SidebarDesktop
        toggleSidebar={toggleSidebar}
        getStorage={getStorage}
        setToggleSidebar={setToggleSidebar}
      />
    );
  else
    return (
      <SidebarMobile
        getStorage={getStorage}
        toggleSidebar={toggleSidebar}
        setToggleSidebar={setToggleSidebar}
      />
    );
}
interface GameListType {
  type: GameTypeEnum;
  title: string;
  component: React.ReactNode;
}

export function SidebarDesktop({
  getStorage,
  toggleSidebar,
  setToggleSidebar,
  ...props
}: PropsType) {
  const { t } = useTranslation();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog, setOpenRegisShopDialog } = useGlobalContext();
  const [openTrainingDialog, setOpenTrainingDialog] = useState<boolean>(false);
  const router = useRouter();

  return (
    <>
      <div
        className={` fixed bottom-0 z-20 flex flex-col bg-white shadow ${
          getStorage == "true" ? "w-56" : ""
        } `}
        style={{ height: "calc(100vh - 56px)" }}
      >
        <div className="v-scrollbar">
          {getStorage == "true" && (
            <SidebarToggleButton
              setToggleSidebar={setToggleSidebar}
              toggleSidebar={toggleSidebar}
            />
          )}

          {/* <Footer /> */}
          <PostPopup />
        </div>
      </div>
      <TrainingDialog isOpen={openTrainingDialog} onClose={() => setOpenTrainingDialog(false)} />
    </>
  );
}

const TrainingDialog = ({ ...props }) => {
  const { t } = useTranslation();

  const Trainings = useMemo(
    () => [
      {
        icon: <RiStore2Line />,

        title: t("Shop của tôi"),
        description: t("Vào trang quản lý Shop của tôi"),
      },
      {
        icon: <RiShoppingBag3Line />,

        title: t("Sản phẩm"),
        description: t("Chọn danh mục sản phẩm để đăng mua/bán sản phẩm của bạn"),
      },
      {
        icon: <RiEdit2Line />,

        title: t("Thêm sản phẩm"),
        description: t("Chọn thêm sản phẩm mới và điền đầy đủ thông tin chi tiết sản phẩm của bạn"),
      },
      {
        icon: <RiMagicLine />,

        title: t("Đăng sản phẩm"),
        description: t("Chọn nút đăng mua/bán và chờ duyệt từ BQT"),
      },
    ],
    []
  );

  return (
    <Dialog title={t("Quy trình đăng mua bán sản phẩm")} width={900} {...props}>
      <Dialog.Body>
        <div className="grid grid-cols-12 gap-x-2">
          {Trainings.map((item, index) => (
            <div key={index} className="flex items-start col-span-3">
              <div className="flex flex-col items-center gap-2 text-center">
                <i className="text-28 text-primary">{item.icon}</i>
                <div className="flex items-center">
                  <div className="font-semibold text-20">{`${index + 1}. ${item.title}`}</div>
                </div>
                <span className="text-sm text-gray-800">{item.description}</span>
              </div>
              <div className="mt-10">
                {Trainings.length > index + 1 && (
                  <i className="text-32 text-primary">
                    <RiArrowRightSFill />
                  </i>
                )}
              </div>
            </div>
          ))}
        </div>
      </Dialog.Body>
    </Dialog>
  );
};
export function SidebarMobile({
  getStorage,
  toggleSidebar,
  setToggleSidebar,
  ...props
}: PropsType) {
  const { t } = useTranslation();
  const screenxs = useScreen("xs");
  const shareRef = useRef();
  const registerCustomerRef = useRef();
  const registerShopRef = useRef();
  const gamesRef = useRef();
  const router = useRouter();
  const { customer } = useAuth();
  const { setOpenCustomerLoginDialog, setOpenRegisShopDialog } = useGlobalContext();

  const checkShowSidebar = useMemo(() => {
    if (screenxs == true && getStorage == "true") {
      return true;
    }
    if (screenxs == true && getStorage == "false") {
      return true;
    }
  }, [screenxs, getStorage]);

  return (
    <>
      <div
        className={`fixed flex flex-col z-20 bg-white shadow ${
          checkShowSidebar ? "w-12" : "w-0"
        } top-14 `}
        style={{ height: "calc(100vh - 56px)" }}
      >
        {checkShowSidebar && (
          <SidebarToggleButton setToggleSidebar={setToggleSidebar} toggleSidebar={toggleSidebar} />
        )}
        <Scrollbars universal={true}>
          <div className="py-3 mb-2">
            <div className="text-center">
              <div ref={registerCustomerRef} className="p-3 cursor-pointer hover:bg-gray-200">
                <RiUserAddLine className="text-xl" />
              </div>

              <div ref={shareRef} className="p-3 cursor-pointer hover:bg-gray-200">
                <HiOutlineShare className="text-xl" />
              </div>
              <div ref={gamesRef} className="p-3 cursor-pointer hover:bg-gray-200">
                <RiGamepadLine className="text-xl" />
              </div>
            </div>
            <Popover
              theme="light-border"
              reference={registerCustomerRef}
              trigger="click"
              placement="right-start"
              arrow
            >
              <div className="flex flex-col items-center w-full p-2 cursor-pointer">
                <Player
                  className=""
                  autoplay
                  loop
                  src={`/assets/lottie/regis-customer.json`}
                  style={{ height: "100px", width: "100px" }}
                ></Player>
                <Button
                  icon={<RiUserAddLine />}
                  text={t("Đăng ký khách hàng")}
                  onClick={() => setOpenCustomerLoginDialog(true)}
                  className="px-2 border border-gray-600 border-dashed rounded-full"
                />
              </div>
            </Popover>

            <Popover
              theme="light-border"
              reference={shareRef}
              trigger="click"
              placement="right-start"
              arrow
            >
              <div
                onClick={() => {
                  router.push("/post/solution-group");
                }}
                className="flex flex-col items-center w-full p-2 cursor-pointer"
              >
                {" "}
                <img className="mb-2 w-44" src="/assets/img/logo-solution.png" />
                <Button
                  icon={<RiArrowUpLine />}
                  text={t("Nhóm của sàn")}
                  className="px-2 border border-gray-600 rounded-full"
                />
              </div>
            </Popover>
            <Popover
              theme="light-border"
              reference={gamesRef}
              trigger="click"
              placement="right-start"
              arrow
            >
              <Category />
            </Popover>
          </div>
        </Scrollbars>
        {/* <PostPopup /> */}

        {/* <Footer /> */}
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
