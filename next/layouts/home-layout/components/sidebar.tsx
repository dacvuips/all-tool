import { Player } from "@lottiefiles/react-lottie-player";
import { useRouter } from "next/router";
import { useEffect, useMemo, useRef, useState } from "react";
import Scrollbars from "react-custom-scrollbars";
import { useTranslation } from "react-i18next";
import { HiOutlineShare } from "react-icons/hi";
import {
  RiArrowDownSLine,
  RiArrowRightSFill,
  RiArrowRightSLine,
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
import { Accordion } from "../../../components/shared/utilities/misc";
import { Dropdown } from "../../../components/shared/utilities/popover/dropdown";
import { Popover } from "../../../components/shared/utilities/popover/popover";
import { useScreen } from "../../../lib/hooks/useScreen";
import { useAuth } from "../../../lib/providers/auth-provider";
import { useGlobalContext } from "../../../lib/providers/global-provider";
import {
  CategoryService,
  Category as CategoryType,
} from "../../../lib/repo/category/category.repo";
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
  const [categoryTree, setCategoryTree] = useState<CategoryType[]>([]);
  const [loadingTree, setLoadingTree] = useState(true);
  const router = useRouter();

  useEffect(() => {
    setLoadingTree(true);
    CategoryService.getActiveCategoryTreeForSidebar()
      .then((tree) => setCategoryTree(tree))
      .finally(() => setLoadingTree(false));
  }, []);

  return (
    <>
      <div
        className={`${
          getStorage == "true" ? "w-60" : "w-0"
        } fixed flex flex-col z-20 bg-white shadow top-14`}
        style={{ height: "calc(100vh - 56px)" }}
      >
        {getStorage == "true" && (
          <SidebarToggleButton setToggleSidebar={setToggleSidebar} toggleSidebar={toggleSidebar} />
        )}
        <Scrollbars
          hideTracksWhenNotNeeded={true}
          autoHideTimeout={0}
          autoHideDuration={300}
          autoHide
        >
          <div className="py-3">
            {/* Nhóm Sản phẩm - cây category */}
            <div className="mb-2">
              <Accordion isOpen={true}>
                {loadingTree ? (
                  <div className="px-4 py-3 text-sm text-gray-500">Đang tải danh mục...</div>
                ) : (
                  <CategoryTreeItems
                    nodes={categoryTree}
                    depth={0}
                    currentCategoryId={router.query.categoryId as string}
                  />
                )}
              </Accordion>
            </div>
            <PostPopup />
          </div>
        </Scrollbars>
      </div>
      <TrainingDialog isOpen={openTrainingDialog} onClose={() => setOpenTrainingDialog(false)} />
    </>
  );
}

/** Render một item danh mục: root (!parentId) luôn hiển thị, click để mở/đóng con; cấp con có con thì dùng Dropdown. */
function CategoryTreeItem({
  node,
  depth,
  currentCategoryId,
}: {
  node: CategoryType;
  depth: number;
  currentCategoryId?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const isRoot = !node.parentId;
  const isDeepLevel = depth >= 2;
  const plMap = ["pl-3", "pl-4", "pl-8", "pl-10", "pl-12"] as const;
  const plClass = plMap[Math.min(depth, plMap.length - 1)] || "pl-12";
  const hasChildren = node.children && node.children.length > 0;
  const isSubCategory = depth >= 1;
  /** Chỉ danh mục con (depth >= 1) và có con thì mới hiện dropdown menu */
  const showDropdown = isSubCategory && hasChildren;
  /** Root có con: click item để mở/đóng danh sách con */
  const [accordionOpen, setAccordionOpen] = useState(false);

  /** Node đang active nếu chính nó hoặc bất kỳ con nào trùng với categoryId trên URL */
  const isActive =
    currentCategoryId === node.id ||
    (hasChildren && node.children!.some((c) => c.id === currentCategoryId));

  const buttonClass = `justify-start w-full font-normal rounded-r-none rounded-l-xl  ${plClass} pr-3 py-2 ${
    isDeepLevel
      ? "bg-green-600 text-white hover:bg-green-700 border-0"
      : isActive
      ? ""
      : "hover:bg-gray-100"
  }`;

  const linkContent = (
    <div className="flex flex-1 gap-2 justify-between items-center w-full min-w-0">
      <span className={`truncate ${depth === 0 ? "font-semibold" : ""}`}>
        {depth !== 0 && <RiArrowRightSFill className="text-gray-500 text-18" />}
        {node.name}
      </span>
      {hasChildren &&
        (accordionOpen ? (
          <RiArrowDownSLine className="text-gray-500 text-20" />
        ) : (
          <RiArrowRightSLine className="text-gray-500 text-20" />
        ))}
    </div>
  );

  if (showDropdown) {
    return (
      <div key={node.id} className="relative">
        <div ref={ref} className="w-full">
          <Button
            primary={isActive && !isDeepLevel}
            className={`${buttonClass} ${
              isActive && !isDeepLevel ? "bg-primary-light text-primary  " : ""
            }`}
            href={{ pathname: "/products", query: { categoryId: node.id } }}
          >
            {linkContent}
          </Button>
        </div>
        <Dropdown
          reference={ref}
          trigger="hover"
          placement="right-start"
          arrow
          theme="light-border"
        >
          {node.children!.map((child) => {
            return (
              <Dropdown.Item
                primary={currentCategoryId === child.id}
                key={child.id}
                text={child.name}
                onClick={() =>
                  router.push({ pathname: "/products", query: { categoryId: child.id } })
                }
              />
            );
          })}
        </Dropdown>
      </div>
    );
  }

  /** Root có con: luôn hiển thị item, click để toggle hiện/ẩn danh sách con */
  if (isRoot && hasChildren) {
    return (
      <div key={node.id}>
        <Button
          primary={isActive}
          className={buttonClass}
          onClick={() => setAccordionOpen((prev) => !prev)}
        >
          {linkContent}
        </Button>
        <Accordion isOpen={accordionOpen}>
          <div className="my-0.5 pl-2 ">
            <CategoryTreeItems
              nodes={node.children!}
              depth={depth + 1}
              currentCategoryId={currentCategoryId}
            />
          </div>
        </Accordion>
      </div>
    );
  }

  /** Root không con hoặc item con: link bình thường */
  return (
    <div key={node.id}>
      <Button
        primary={currentCategoryId === node.id && !isDeepLevel}
        className={`${buttonClass} ${isActive ? "bg-primary-light text-primary" : ""}`}
        href={{ pathname: "/products", query: { categoryId: node.id } }}
      >
        {linkContent}
      </Button>
    </div>
  );
}

/** Render cây category: root (!parentId) luôn hiển thị, click để mở/đóng con; cấp con có con thì Dropdown. */
function CategoryTreeItems({
  nodes,
  depth,
  currentCategoryId,
}: {
  nodes: CategoryType[];
  depth: number;
  currentCategoryId?: string;
}) {
  if (!nodes?.length) return null;

  return (
    <>
      {nodes.map((node) => (
        <div key={node.id}>
          <CategoryTreeItem node={node} depth={depth} currentCategoryId={currentCategoryId} />
        </div>
      ))}
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
            <div key={index} className="flex col-span-3 items-start">
              <div className="flex flex-col gap-2 items-center text-center">
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
              <div className="flex flex-col items-center p-2 w-full cursor-pointer">
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
                  className="px-2 rounded-full border border-gray-600 border-dashed"
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
                className="flex flex-col items-center p-2 w-full cursor-pointer"
              >
                {" "}
                <img className="mb-2 w-44" src="/assets/img/logo-solution.png" />
                <Button
                  icon={<RiArrowUpLine />}
                  text={t("Nhóm của sàn")}
                  className="px-2 rounded-full border border-gray-600"
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
