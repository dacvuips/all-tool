import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IntroGuideKey } from "../../../shared/utilities/intro/intro-guide-storage";
import { useIntroGuide } from "../../../shared/utilities/intro/useIntroGuide";
import { useIntroGuideSeen } from "../../../shared/utilities/intro/useIntroGuideSeen";
import {
  AffiliateRightPanelIntroOptions,
  getAffiliateRightPanelIntroSteps,
} from "./affiliate-right-panel-intro-steps";
import { AffiliateRightPanelIntro } from "./affiliate-right-panel-intro";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

interface UseAffiliateRightPanelIntroParams extends AffiliateRightPanelIntroOptions {
  /** Key sidebar của tab hiện tại — auto-show batch chỉ sau khi đã xem sidebar tab đó */
  sidebarIntroKey: IntroGuideKey;
  sceneCount: number;
}

/** Right panel batch list — 1 key localStorage chung (BATCH_LIST), auto-show sau sidebar + > 1 cảnh */
export function useAffiliateRightPanelIntro({
  sidebarIntroKey,
  sceneCount,
  hasProductImages,
  includeSceneCardSteps,
}: UseAffiliateRightPanelIntroParams) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();
  const hasEnoughScenes = sceneCount > 1;
  const sidebarIntroSeen = useIntroGuideSeen(sidebarIntroKey);
  const canAutoShow = hasEnoughScenes && sidebarIntroSeen;

  const { introOpen, openIntro: rawOpenIntro, handleIntroDismiss } = useIntroGuide(
    IntroGuideKey.BATCH_LIST,
    {
      autoShowMode: "when-ready",
      enabled: canAutoShow && introEnabled,
      autoShow: introEnabled,
      watchTrigger: canAutoShow ? "ready" : "not-ready",
      autoShowDelay: 900,
    }
  );

  const openIntro = useCallback(() => {
    if (!introEnabled) return;
    rawOpenIntro();
  }, [introEnabled, rawOpenIntro]);

  const introSteps = useMemo(
    () =>
      getAffiliateRightPanelIntroSteps(t, {
        hasProductImages,
        sceneCount,
        includeSceneCardSteps,
      }),
    [t, hasProductImages, sceneCount, includeSceneCardSteps]
  );

  const introElement = (
    <AffiliateRightPanelIntro
      isOpen={introEnabled && introOpen}
      steps={introSteps}
      onDismiss={handleIntroDismiss}
    />
  );

  return {
    introOpen: introEnabled && introOpen,
    openIntro,
    handleIntroDismiss,
    introElement,
  };
}

/** @deprecated Dùng useAffiliateRightPanelIntro */
export const useAffiliateBatchListIntro = useAffiliateRightPanelIntro;
