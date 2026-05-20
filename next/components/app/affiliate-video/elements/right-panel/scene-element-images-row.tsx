/**
 * Hàng 3 ô ảnh tham chiếu theo scene – auto-match tên ảnh trong prompt.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../constants";
import {
  elementImageSlotsToUrls,
  matchElementImagesInPrompt,
} from "../utils/matchElementImagesInPrompt";
import { SceneElementImageSlot } from "./scene-element-image-slot";

const SLOT_COUNT = 3;

export interface SceneElementImagesRowProps {
  sceneId: string;
  prompt: string;
  elementFormConfig?: ElementFormConfig;
  savedSlots?: (ElementFormImage | undefined)[];
  readOnly?: boolean;
  onSlotsChange: (slots: (ElementFormImage | undefined)[]) => void;
}

export function SceneElementImagesRow({
  sceneId,
  prompt,
  elementFormConfig,
  savedSlots,
  readOnly = false,
  onSlotsChange,
}: SceneElementImagesRowProps) {
  const { t } = useTranslation();

  const hasConfigImages = !!(
    elementFormConfig?.artStyleImg?.imageBytes ||
    elementFormConfig?.objectImg?.imageBytes ||
    elementFormConfig?.itemImg?.imageBytes ||
    elementFormConfig?.artStyleImg?.fifeUrl ||
    elementFormConfig?.objectImg?.fifeUrl ||
    elementFormConfig?.itemImg?.fifeUrl
  );

  const autoMatched = useMemo(
    () => matchElementImagesInPrompt(prompt, elementFormConfig),
    [prompt, elementFormConfig]
  );

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );
  const [manualMask, setManualMask] = useState<boolean[]>([false, false, false]);
  const lastNotifiedRef = useRef<string>("");

  useEffect(() => {
    setSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched]);
    setManualMask([false, false, false]);
    lastNotifiedRef.current = "";
  }, [sceneId]);

  useEffect(() => {
    setSlots((prev) => {
      const next = autoMatched.map((img, i) => (manualMask[i] ? prev[i] : img));
      return next;
    });
  }, [autoMatched, manualMask]);

  const notifyParent = useCallback(
    (next: (ElementFormImage | undefined)[]) => {
      const key = elementImageSlotsToUrls(next).join("|");
      if (key === lastNotifiedRef.current) return;
      lastNotifiedRef.current = key;
      onSlotsChange(next);
    },
    [onSlotsChange]
  );

  useEffect(() => {
    notifyParent(slots);
  }, [slots, notifyParent]);

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
      <div className="flex gap-2 mt-1">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <SceneElementImageSlot
            key={i}
            slotIndex={i + 1}
            value={slots[i]}
            readOnly={readOnly}
            onChange={(v) => handleSlotChange(i, v)}
          />
        ))}
      </div>
    </div>
  );
}
