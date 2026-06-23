import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { IntroGuideKey } from "../../../shared/utilities/intro/intro-guide-storage";
import { useIntroGuide } from "../../../shared/utilities/intro/useIntroGuide";
import {
  AffiliateBatchListIntroOptions,
  getAffiliateBatchListIntroSteps,
} from "./affiliate-batch-list-intro-steps";
import { AffiliateIntroStep } from "./affiliate-intro-step";
import { useAffiliateIntroEnabled } from "./use-affiliate-intro-enabled";

interface UseAffiliateBatchListIntroParams extends AffiliateBatchListIntroOptions {
  storageKey: IntroGuideKey;
  sceneCount: number;
}

/** Right panel batch list — auto-show 1 lần khi có > 1 cảnh, lưu localStorage */
export function useAffiliateBatchListIntro({
  storageKey,
  sceneCount,
  hasHistory,
  hasProductImages,
  includeSceneCardSteps,
}: UseAffiliateBatchListIntroParams) {
  const { t } = useTranslation();
  const introEnabled = useAffiliateIntroEnabled();
  const hasEnoughScenes = sceneCount > 1;

  const { introOpen, openIntro: rawOpenIntro, handleIntroDismiss } = useIntroGuide(storageKey, {
    autoShowMode: "when-ready",
    enabled: hasEnoughScenes && introEnabled,
    autoShow: introEnabled,
    watchTrigger: hasEnoughScenes ? "ready" : "not-ready",
    autoShowDelay: 900,
  });

  const openIntro = useCallback(() => {
    if (!introEnabled) return;
    rawOpenIntro();
  }, [introEnabled, rawOpenIntro]);

  const introSteps = useMemo(
    () =>
      getAffiliateBatchListIntroSteps(t, {
        hasHistory,
        hasProductImages,
        sceneCount,
        includeSceneCardSteps,
      }),
    [t, hasHistory, hasProductImages, sceneCount, includeSceneCardSteps]
  );

  const introElement = (
    <AffiliateIntroStep
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
