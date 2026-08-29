/**
 * Hàng 3 ô ảnh tham chiếu theo scene – auto-match tên ảnh trong prompt (tối đa 3, theo thứ tự xuất hiện).
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../../constants";
import {
  elementImageSlotsFingerprint,
  ElementImageSlotsChangeHandler,
  resolveSlotsFromCatalog,
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

  const autoMatched = useMemo(
    () => matchElementImagesInPrompt(prompt, elementFormConfig),
    [prompt, elementFormConfig]
  );

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => false)
  );

  useEffect(() => {
    setSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched]);
    setManualMask(
      savedSlots?.length
        ? Array.from({ length: SLOT_COUNT }, (_, i) => !!savedSlots[i])
        : Array.from({ length: SLOT_COUNT }, () => false)
    );
  }, [sceneId]);

  useEffect(() => {
    setSlots((prev) => {
      const next = autoMatched.map((img, i) => (manualMask[i] ? prev[i] : img));
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(next) ? prev : next;
    });
  }, [autoMatched, manualMask]);

  useSceneElementImagesRowNotify(sceneId, slots, manualMask, onSlotsChange);

  const displaySlots = useMemo(
    () => resolveSlotsFromCatalog(slots, elementFormConfig),
    [slots, elementFormConfig, autoMatched]
  );

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
