/**
 * affiliate-video.tsx
 * Trang chính – layout phía trên gồm top nav + body content
 * - Navigation tabs cho các chế độ tạo video
 * className only – Tailwind CSS, no inline styles
 */
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { RiFileCopy2Line, RiFileTextLine, RiGridLine, RiShirtLine } from "react-icons/ri";

import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { TAB_TYPE } from "./constants";
import { AffiliateSingleVideoPage } from "./single/single-video-page";

export default function AffiliateMainPage() {
  const { t } = useTranslation();
  const router = useRouter();

  /** Các tab chế độ tạo video */
  const navigationTabs = [
    {
      icon: <RiFileTextLine />,
      label: t("Đơn Lẻ"),
      value: "single",
      component: <AffiliateSingleVideoPage type={TAB_TYPE.single} />,
    },
    {
      icon: <RiGridLine />,
      label: t("Hàng Loạt"),
      value: "batch",
      component: <AffiliateSingleVideoPage type={TAB_TYPE.batch} />,
    },
    // { icon: <RiBookOpenLine />, label: t("Cốt Truyện"), value: "story" },
    {
      icon: <RiFileCopy2Line />,
      label: t("Sao Chép"),
      value: "copy",
      component: <AffiliateSingleVideoPage type={TAB_TYPE.single} />,
    },
    // { icon: <RiStackLine />, label: t("Nhân Bản"), value: " nhân bản" },
    {
      icon: <RiShirtLine />,
      label: t("Thời Trang"),
      value: "thoi-trang",
      component: <>{"Đang phát tiển"}</>,
    },
    // { icon: <RiSettings3Line />, label: t("Chế độ Nâng cao") },
    // { icon: <RiVideoDownloadLine />, label: t("Review sản phẩm") },
  ];

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-amber-50"
      style={{ height: "calc(100vh - 10px)" }}
    >
      {/* ══ TOP NAV – thanh điều hướng chính ══ */}
      <TabGroup
        name="affiliate-video-nav"
        index={Math.max(
          0,
          navigationTabs.findIndex((item) => item.value === router.query.tab)
        )}
        onChange={(index) => {
          const selectedTab = navigationTabs[index];
          if (selectedTab?.value) {
            router.push(
              {
                pathname: router.pathname,
                query: { ...router.query, tab: selectedTab.value },
              },
              undefined,
              { shallow: true }
            );
          }
        }}
        flex={false}
        className="border-transparent pl-0 h-12 flex items-center overflow-x-auto flex-shrink-0"
        tabClassName="px-3 py-2.5"
        titleClassName="text-xs font-medium whitespace-nowrap"
        bodyClassName="flex-1 flex flex-col overflow-hidden relative w-full h-full"
        hasArrow
        activeClassName=""
      >
        {navigationTabs.map((item, i) => (
          <TabGroup.Tab
            key={i}
            label={
              <span className="flex items-center gap-1.5">
                {item.icon} {item.label}
              </span>
            }
          >
            <>{item.component}</>
          </TabGroup.Tab>
        ))}
      </TabGroup>
    </div>
  );
}
