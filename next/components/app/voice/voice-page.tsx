import { useState } from "react";
import { AffiliateVideoSidebarLayout } from "../affiliate-video/shared/affiliate-video-sidebar-layout";
import { VoiceProvider } from "./voice-provider";
import { VoiceRightPanel } from "./voice-right-panel";
import { VoiceSidebar } from "./voice-sidebar";

export function VoicePage() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <VoiceProvider>
      <AffiliateVideoSidebarLayout
        storageKey="affiliate-voice-sidebar-width"
        isOpen={isSidebarOpen}
        onOpenChange={setIsSidebarOpen}
        sidebar={<VoiceSidebar onClose={() => setIsSidebarOpen(false)} />}
      >
        <VoiceRightPanel />
      </AffiliateVideoSidebarLayout>
    </VoiceProvider>
  );
}
