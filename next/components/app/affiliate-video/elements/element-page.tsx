/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { ElementProvider } from "./providers/element-provider";
import { ElementRightPanel } from "./right-panel/element-right-panel";
import { ElementForm } from "./sibar/elementForm";

interface ElementProps {}

export const ElementPage = ({}: ElementProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ElementProvider>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<ElementForm onClose={() => setIsSidebarOpen(false)} />}
      >
        <ElementRightPanel />
      </AffiliateVideoSidebarLayout>
    </ElementProvider>
  );
};
