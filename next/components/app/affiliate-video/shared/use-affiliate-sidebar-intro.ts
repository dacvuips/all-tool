import { useCallback } from "react";
import { IntroGuideKey } from "../../../shared/utilities/intro/intro-guide-storage";
import { useIntroGuide } from "../../../shared/utilities/intro/useIntroGuide";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

/** Sidebar / AffiliateConfig — auto-show 1 lần khi khách chuyển vào tab (theo key localStorage) */
export function useAffiliateSidebarIntro(storageKey: IntroGuideKey) {
  const introEnabled = useAffiliateIntroEnabled();

  const { introOpen, openIntro: rawOpenIntro, handleIntroDismiss, hasSeen } = useIntroGuide(
    storageKey,
    {
      autoShowMode: "on-mount",
      autoShowDelay: 800,
      autoShow: introEnabled,
      enabled: introEnabled,
    }
  );

  const openIntro = useCallback(() => {
    if (!introEnabled) return;
    rawOpenIntro();
  }, [introEnabled, rawOpenIntro]);

  return {
    introOpen: introEnabled && introOpen,
    openIntro,
    handleIntroDismiss,
    hasSeen,
  };
}
