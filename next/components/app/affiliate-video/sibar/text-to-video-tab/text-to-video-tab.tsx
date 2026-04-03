/**
 * text-to-video-tab.tsx
 * Sidebar layout: Config form + Submit button, light theme
 */
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";

export const TextToVideoTab = () => {
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Scrollable config area */}
      <div className="flex-1 overflow-y-auto">
        <AffiliateConfig />
      </div>
      {/* Fixed submit at bottom */}
      <AffiliateSubmit />
    </div>
  );
};
