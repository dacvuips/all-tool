/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { AffiliateVideoProvider } from "./providers/affiliate-video-provider";
import { AffiliateVideoRightPanel } from "./right-panel/right-panel-main";
import { TextToVideoTab } from "./sibar/text-to-video-tab";

interface TrendingPageProps {}

export const TrendingPage = ({}: TrendingPageProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AffiliateVideoProvider openSidebar={() => setIsSidebarOpen(true)}>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<TextToVideoTab onClose={() => setIsSidebarOpen(false)} />}
      >
        <AffiliateVideoRightPanel />
      </AffiliateVideoSidebarLayout>
    </AffiliateVideoProvider>
  );
};
