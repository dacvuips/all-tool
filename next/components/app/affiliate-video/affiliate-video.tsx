/**
 * affiliate-video.tsx
 * Trang chính – layout phía trên gồm top nav + body content
 * - Navigation tabs cho các chế độ tạo video
 * className only – Tailwind CSS, no inline styles
 */
import { useTranslation } from "react-i18next";
import {
  RiBookOpenLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiGridLine,
  RiSettings3Line,
  RiShirtLine,
  RiStackLine,
} from "react-icons/ri";

import { TabGroup } from "../../shared/utilities/tab/tab-group";
import { AffiliateVideoBody } from "./affiliate-video-body";

export default function AffiliateVideo() {
  const { t } = useTranslation();

  /** Các tab chế độ tạo video */
  const navigationTabs = [
    { icon: <RiFileTextLine />, label: t("Đơn Lẻ") },
    { icon: <RiGridLine />, label: t("Hàng Loạt") },
    { icon: <RiBookOpenLine />, label: t("Cốt Truyện") },
    { icon: <RiFileCopyLine />, label: t("Sao Chép") },
    { icon: <RiStackLine />, label: t("Nhân Bản") },
    { icon: <RiShirtLine />, label: t("Thời Trang") },
    { icon: <RiSettings3Line />, label: t("Chế độ Nâng cao") },
  ];

  return (
    <div
      className="flex flex-col h-screen overflow-hidden bg-amber-50"
      style={{ height: "calc(100vh - 10px)" }}
    >
      {/* ══ TOP NAV – thanh điều hướng chính ══ */}
      <div className="flex items-center h-12 border-gray-200/80 flex-shrink-0 bg-white overflow-x-auto">
        <TabGroup
          name="affiliate-video-nav"
          flex={false}
          className="border-transparent pl-0"
          tabClassName="px-3 py-2.5"
          titleClassName="text-xs font-medium whitespace-nowrap"
          bodyClassName="hidden"
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
              <></>
            </TabGroup.Tab>
          ))}
        </TabGroup>
      </div>

      {/* ══ MAIN LAYOUT – sidebar trái + panel phải ══ */}
      <AffiliateVideoBody />
    </div>
  );
}
