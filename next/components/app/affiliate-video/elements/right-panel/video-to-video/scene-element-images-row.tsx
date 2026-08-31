/**
 * Hàng ô ảnh tham chiếu theo scene – auto-match tên ảnh trong prompt (tối đa 4, theo thứ tự xuất hiện).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../../constants";
import { autoModeImagesFingerprint } from "../../utils/elementActionImageUtils";
import {
  deriveManualMaskForElementSlots,
  elementImageSlotsFingerprint,
  ElementImageSlotsChangeHandler,
  mergeElementImageSlotsFromScene,
  resolveSlotsFromCatalog,
  slotHasDisplayMedia,
} from "../../utils/elementImageSlotPersist";
import { matchElementImagesInPrompt } from "../../utils/matchElementImagesInPrompt";
import { useSceneElementImagesRowNotify } from "../useSceneElementImagesRowNotify";
import { SceneElementImageSlot } from "../scene-element-image-slot";

const SLOT_COUNT = 4;

export interface SceneElementImagesRowProps {
  sceneId: string;
  prompt: string;
  elementFormConfig?: ElementFormConfig;
  savedSlots?: (ElementFormImage | undefined)[];
  readOnly?: boolean;
  onSlotsChange: ElementImageSlotsChangeHandler;
  hideLabel?: boolean;
}

export function SceneElementImagesRow({
  sceneId,
  prompt,
  elementFormConfig,
  savedSlots,
  readOnly = false,
  onSlotsChange,
  hideLabel = false,
}: SceneElementImagesRowProps) {
  const { t } = useTranslation();

  const autoImagesKey = useMemo(
    () => autoModeImagesFingerprint(elementFormConfig),
    [elementFormConfig?.artStyleImg, elementFormConfig?.objectImg, elementFormConfig?.itemImg]
  );

  const autoMatched = useMemo(
    () => matchElementImagesInPrompt(prompt, elementFormConfig),
    [prompt, autoImagesKey]
  );

  const autoMatchedKey = useMemo(
    () => elementImageSlotsFingerprint(autoMatched),
    [autoMatched]
  );

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => false)
  );

  const manualMaskRef = useRef(manualMask);
  manualMaskRef.current = manualMask;

  const savedSlotsKey = useMemo(
    () => (savedSlots?.length ? elementImageSlotsFingerprint(savedSlots) : ""),
    [savedSlots]
  );

  useEffect(() => {
    const initial = savedSlots?.length ? [...savedSlots] : [...autoMatched];
    setSlots(initial);
    setManualMask(
      savedSlots?.length
        ? deriveManualMaskForElementSlots(savedSlots, autoMatched, SLOT_COUNT)
        : Array.from({ length: SLOT_COUNT }, () => false)
    );
  }, [sceneId]);

  useEffect(() => {
    if (!savedSlotsKey) return;
    setSlots((prev) => {
      const merged = mergeElementImageSlotsFromScene(
        prev,
        savedSlots!.slice(0, SLOT_COUNT),
        SLOT_COUNT
      );
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(merged)
        ? prev
        : merged;
    });
    setManualMask(deriveManualMaskForElementSlots(savedSlots!, autoMatched, SLOT_COUNT));
  }, [savedSlotsKey, savedSlots, autoMatchedKey]);

  useEffect(() => {
    setSlots((prev) => {
      const mask = manualMaskRef.current;
      const next = autoMatched.map((img, i) => (mask[i] ? prev[i] : img));
      while (next.length < SLOT_COUNT) next.push(undefined);
      const trimmed = next.slice(0, SLOT_COUNT);
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(trimmed)
        ? prev
        : trimmed;
    });
  }, [autoMatchedKey, autoMatched]);

  useSceneElementImagesRowNotify(sceneId, slots, manualMask, onSlotsChange);

  const displaySlots = useMemo(() => {
    const merged = Array.from({ length: SLOT_COUNT }, (_, i) => {
      const saved = savedSlots?.[i];
      const local = slots[i];
      const savedHasMedia = slotHasDisplayMedia(saved);
      const localHasMedia = slotHasDisplayMedia(local);
      if (savedHasMedia) return saved;
      if (localHasMedia) return local;
      return saved ?? local ?? autoMatched[i];
    });
    return resolveSlotsFromCatalog(merged, elementFormConfig);
  }, [savedSlots, slots, elementFormConfig, autoMatched, autoMatchedKey]);

  const handleSlotChange = useCallback((index: number, value: ElementFormImage | undefined) => {
    setManualMask((mask) => {
      const nextMask = [...mask];
      nextMask[index] = true;
      return nextMask;
    });
    setSlots((prev) => {
      const next = [...prev];
      next[index] = value;
      while (next.length < SLOT_COUNT) next.push(undefined);
      return next.slice(0, SLOT_COUNT);
    });
  }, []);

  const filledCount = slots.filter(Boolean).length;

  return (
    <div className="relative">
      {!hideLabel && (
        <div className="flex justify-between items-center">
          {" "}
          <span className="mr-1 text-xs font-bold tracking-wide text-blue-600 uppercase">
            {t("Ảnh tham chiếu")}:
          </span>
          {filledCount > 0 && (
            <span className="text-9 text-blue-500 mt-0.5 block">
              {t("Đã gắn")} {filledCount}/{SLOT_COUNT}
            </span>
          )}
        </div>
      )}
      <div className="mt-1 flex flex-nowrap gap-2">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <SceneElementImageSlot
            key={i}
            slotIndex={i + 1}
            value={displaySlots[i]}
            readOnly={readOnly}
            onChange={(v) => handleSlotChange(i, v)}
            imageClass="w-11 h-11"
          />
        ))}
      </div>
    </div>
  );
}
