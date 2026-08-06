/**
 * Tab Xóa Logo AI — form trái + panel kết quả phải
 */
import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { RemoveLogoProvider } from "./providers/remove-logo-provider";
import { RemoveLogoRightPanel } from "./right-panel/remove-logo-right-panel";
import { RemoveLogoForm } from "./sibar/remove-logo-form";

export function RemoveLogoPage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <RemoveLogoProvider>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<RemoveLogoForm onClose={() => setIsSidebarOpen(false)} />}
      >
        <RemoveLogoRightPanel />
      </AffiliateVideoSidebarLayout>
    </RemoveLogoProvider>
  );
}
