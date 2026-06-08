import { useState } from "react";

import { AffiliateVideoProvider } from "../chatbot/providers/affiliate-video-provider";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";

import { AppVideoRightPanel } from "./right-panel/right-panel-main";
import { AppSidebarTab } from "./sibar/text-to-video-tab";

export const AppPage = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <AffiliateVideoProvider openSidebar={() => setIsSidebarOpen(true)}>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<AppSidebarTab onClose={() => setIsSidebarOpen(false)} />}
      >
        <AppVideoRightPanel />
      </AffiliateVideoSidebarLayout>
    </AffiliateVideoProvider>
  );
};
