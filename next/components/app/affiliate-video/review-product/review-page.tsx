/**
 * affiliate-video-body.tsx
 * Layout chính: sidebar trái + panel phải
 * - Responsive: sidebar ẩn trên mobile, hiện toggle button
 * className only – Tailwind CSS
 */
import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../shared/affiliate-video-sidebar-layout";
import { ReviewProvider } from "./providers/review-provider";
import { ReviewRightPanel } from "./right-panel/review-right-panel";
import { ReviewForm } from "./sibar/reviewForm";

interface ReviewProps {}

export const ReviewPage = ({}: ReviewProps) => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <ReviewProvider>
      <AffiliateVideoSidebarLayout
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<ReviewForm onClose={() => setIsSidebarOpen(false)} />}
      >
        <ReviewRightPanel />
      </AffiliateVideoSidebarLayout>
    </ReviewProvider>
  );
};
