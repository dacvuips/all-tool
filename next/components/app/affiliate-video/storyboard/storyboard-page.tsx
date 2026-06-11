/**

 * affiliate-video-body.tsx

 * Layout chính: sidebar trái + panel phải

 * - Responsive: sidebar ẩn trên mobile, hiện toggle button

 * className only – Tailwind CSS

 */

import { useState } from "react";

import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";

import { AffiliateVideoProvider } from "./providers/affiliate-video-provider";
import { StoryboardRightPanel } from "./right-panel/storyboard-right-panel";

import { TextToVideoTab } from "./sibar/text-to-video-tab";

interface StoryboardPageProps {}

export const StoryboardPage = ({}: StoryboardPageProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AffiliateVideoProvider>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<TextToVideoTab onClose={() => setIsSidebarOpen(false)} />}
      >
        <StoryboardRightPanel />
      </AffiliateVideoSidebarLayout>
    </AffiliateVideoProvider>
  );
};
