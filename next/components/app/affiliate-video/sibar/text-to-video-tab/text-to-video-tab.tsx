/**
 * text-to-video-tab.tsx
 * Sidebar layout: Config form + Submit button, light theme
 */
import { Form } from "../../../../shared/utilities/form";
import { useAffiliateVideoContext } from "../../providers/affiliate-video-provider";
import { AffiliateConfig } from "./affiliate-config";
import { AffiliateSubmit } from "./affiliate-submit";
import { Tip } from "./tip";

export const TextToVideoTab = () => {
  const { handleSubmit } = useAffiliateVideoContext();
  return (
    <div className="flex flex-col h-full overflow-hidden bg-white">
      {/* Scrollable config area */}{" "}
      <div className="flex-1 overflow-y-auto">
        <Form onSubmit={handleSubmit}>
          <AffiliateConfig />

          {/* Fixed submit at bottom */}
          <AffiliateSubmit />
          <Tip />
        </Form>
      </div>
    </div>
  );
};
