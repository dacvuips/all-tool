/**
 * affiliate-video.tsx
 * Trang chính – layout phía trên gồm top nav + body content
 * - Navigation tabs cho các chế độ tạo video
 * className only – Tailwind CSS, no inline styles
 */
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import {
  RiBookOpenLine,
  RiFileCopy2Line,
  RiGridLine,
  RiImage2Fill,
  RiListOrdered,
  RiMagicLine,
} from "react-icons/ri";

import { IoAppsSharp } from "react-icons/io5";
import { useScreen } from "../../../lib/hooks/useScreen";
import { TrendingTypeEnum } from "../../../lib/repo/list/trending.repo";
import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { AppPage } from "./app/app-page";
import { TAB_TYPE } from "./constants";
import { AffiliateCopyVideoPage } from "./copy-video/copy-video-page";
import { ElementPage } from "./elements/element-page";
import { RemoveLogoPage } from "./remove-logo/remove-logo-page";
import { ReviewPage } from "./review-product/review-page";
import { AffiliateSingleVideoPage } from "./single/single-video-page";
import { StoryboardPage } from "./storyboard/storyboard-page";
import { TrendingPage } from "./trending/trending-page";
import { WolfSlideOutWidget } from "./wolf-slide-out/wolf-slide-out";

export default function AffiliateMainPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const xl = useScreen("xl");
  /** Các tab chế độ tạo video */
  const navigationTabs = [
    // { icon: <RiStackLine />, label: t("Nhân Bản"), value: " nhân bản" },
    {
      icon: (
        <div className="px-1 -mr-1 text-xs font-semibold text-red-600 rounded-full border border-red-600">
          {"Hot 🔥"}
        </div>
      ),
      label: t("Trending"),
      value: TrendingTypeEnum.PROMPT,
      component: <TrendingPage />,
    },

    {
      icon: "🔥",
      label: t("App"),
      value: "app",
      component: <AppPage />,
    },

    // {
    //   icon: <RiFileTextLine />,
    //   label: t("Đơn Lẻ"),
    //   value: "single",
    //   component: <AffiliateSingleVideoPage type={TAB_TYPE.single} />,
    // },
    {
      icon: <RiGridLine />,
      label: t("Kịch Bản"),
      value: "batch",
      component: <AffiliateSingleVideoPage type={TAB_TYPE.batch} />,
    },
    // { icon: <RiBookOpenLine />, label: t("Cốt Truyện"), value: "story" },
    {
      icon: <RiFileCopy2Line />,
      label: t("Sao Chép"),
      value: "copy",
      component: <AffiliateCopyVideoPage />,
    },
    {
      icon: <RiListOrdered />,
      label: t("Hàng Loạt"),
      value: "elements",
      component: <ElementPage />,
    },

    {
      icon: <RiBookOpenLine />,
      label: `${t("Review Sản Phẩm")}/${t("thời trang")}`,
      value: "product-review",
      component: <ReviewPage />,
    },
    {
      icon: <IoAppsSharp />,
      label: t("Storyboard"),
      value: "storyboard",
      component: <StoryboardPage />,
    },
    {
      icon: <RiMagicLine />,
      label: t("Xóa Logo AI"),
      value: "remove-logo",
      component: <RemoveLogoPage />,
    },

    {
      icon: <RiImage2Fill />,
      label: t("Làm Phim"),
      value: "make-film",
      component: <>{"Sắp xong rồi"}</>,
    },

    // { icon: <RiSettings3Line />, label: t("Chế độ Nâng cao") },
    // { icon: <RiVideoDownloadLine />, label: t("Review sản phẩm") },
  ];

  return (
    <div
      className="flex overflow-hidden flex-col h-screen bg-amber-50"
      style={{ height: `calc(100vh - ${xl ? 190 : 100}px)` }}
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
        className="flex overflow-x-auto flex-shrink-0 items-center pl-0 h-12 border-transparent"
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
      <WolfSlideOutWidget />
    </div>
  );
}
