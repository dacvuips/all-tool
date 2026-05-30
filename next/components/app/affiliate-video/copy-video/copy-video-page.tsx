/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { CopyVideoProvider } from "./providers/copy-video-provider";
import { CopyVideoRightPanel } from "./right-panel/affiliate-video-right-panel";
import { CopyVideoForm } from "./sibar/copyVideoForm";

interface AffiliateCopyVideoProps {}

export const AffiliateCopyVideoPage = ({}: AffiliateCopyVideoProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <CopyVideoProvider>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<CopyVideoForm onClose={() => setIsSidebarOpen(false)} />}
      >
        <CopyVideoRightPanel />
      </AffiliateVideoSidebarLayout>
    </CopyVideoProvider>
  );
};
