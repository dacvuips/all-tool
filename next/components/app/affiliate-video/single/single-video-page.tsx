/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { TAB_TYPE } from "../constants";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { AffiliateVideoRightPanel } from "./right-panel/affiliate-video-right-panel";
import { TextToVideoTab } from "./sibar/text-to-video-tab";
import { IntroGuideKey } from "../../../shared/utilities/intro/intro-guide-storage";

interface AffiliateSingleVideoPageProps {
  type: TAB_TYPE;
}

export const AffiliateSingleVideoPage = ({ type }: AffiliateSingleVideoPageProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AffiliateVideoSidebarLayout
      isOpen={isSidebarOpen}
      onOpenChange={setIsSidebarOpen}
      sidebar={<TextToVideoTab onClose={() => setIsSidebarOpen(false)} type={type} />}
    >
      <AffiliateVideoRightPanel
        batchSidebarIntroKey={
          type === TAB_TYPE.single
            ? IntroGuideKey.SINGLE_SIDEBAR
            : IntroGuideKey.BATCH_SIDEBAR
        }
      />
    </AffiliateVideoSidebarLayout>
  );
};

