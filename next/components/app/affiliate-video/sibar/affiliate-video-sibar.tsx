/**
 * affiliate-video-sibar.tsx
 * Two-column layout: left sidebar + right panel, light/white theme
 * className only – Tailwind CSS
 */
import { AffiliateVideoRightPanel } from "../right-panel/affiliate-video-right-panel";
import { TextToVideoTab } from "./text-to-video-tab/text-to-video-tab";

export const AffiliateVideoSibar = () => {
  return (
    <div className="flex flex-1 overflow-hidden">
      {/* ══ LEFT SIDEBAR ══ */}
      <div className="w-80 flex-shrink-0 flex flex-col border-r border-gray-200 overflow-hidden bg-white">
        <TextToVideoTab />
      </div>

      {/* ══ RIGHT PANEL ══ */}
      <AffiliateVideoRightPanel />
    </div>
  );
};
