/**
 * Hàng 3 ô ảnh tham chiếu theo scene – auto-match tên ảnh trong prompt (tối đa 3, theo thứ tự xuất hiện).
 * Tab Thành phần luôn cố định 3 slot → Flow2 video_mode component.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../../constants";
import { ActionImageEnum } from "../../constants";
import {
  autoModeImagesFingerprint,
  resolveActionImageType,
  sequentialImagesFingerprint,
} from "../../utils/elementActionImageUtils";
import { ELEMENT_COMPONENT_IMAGE_SLOT_COUNT } from "../../utils/elementFormImageUtils";
import {
  deriveManualMaskForElementSlots,
  elementImageSlotsFingerprint,
  ElementImageSlotsChangeHandler,
  resolveSlotsFromCatalog,
  slotHasDisplayMedia,
} from "../../utils/elementImageSlotPersist";
import { matchElementImagesForScene } from "../../utils/matchElementImagesInPrompt";
import { useSceneElementImagesRowNotify } from "../useSceneElementImagesRowNotify";
import { SceneElementImageSlot } from "../scene-element-image-slot";

const SLOT_COUNT = ELEMENT_COMPONENT_IMAGE_SLOT_COUNT;

export interface SceneElementImagesRowProps {
  sceneId: string;
  sceneNumber: number;
  prompt: string;
  elementFormConfig?: ElementFormConfig;
  savedSlots?: (ElementFormImage | undefined)[];
  readOnly?: boolean;
  onSlotsChange: ElementImageSlotsChangeHandler;
  hideLabel?: boolean;
}

export function SceneElementImagesRow({
  sceneId,
  sceneNumber,
  prompt,
  elementFormConfig,
  savedSlots,
  readOnly = false,
  onSlotsChange,
  hideLabel = false,
}: SceneElementImagesRowProps) {
  const { t } = useTranslation();

  const actionImageType = resolveActionImageType(elementFormConfig);
  const isSequentialImageMode = actionImageType === ActionImageEnum.sequential;

  const sequentialImagesKey = useMemo(
    () => sequentialImagesFingerprint(elementFormConfig?.artStyleImgSequential),
    [elementFormConfig?.artStyleImgSequential]
  );
  const autoImagesKey = useMemo(
    () => autoModeImagesFingerprint(elementFormConfig),
    [elementFormConfig?.artStyleImg, elementFormConfig?.objectImg, elementFormConfig?.itemImg]
  );

  const autoMatched = useMemo(
    () => matchElementImagesForScene(sceneNumber, prompt, elementFormConfig),
    [sceneNumber, prompt, actionImageType, isSequentialImageMode ? sequentialImagesKey : autoImagesKey]
  );

  const autoMatchedKey = useMemo(() => elementImageSlotsFingerprint(autoMatched), [autoMatched]);

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => false)
  );
  const prevActionImageTypeRef = useRef(actionImageType);

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
    prevActionImageTypeRef.current = actionImageType;
  }, [sceneId]);

  useEffect(() => {
    if (prevActionImageTypeRef.current === actionImageType) return;
    prevActionImageTypeRef.current = actionImageType;
    const next = [...autoMatched];
    setSlots(next);
    setManualMask(Array.from({ length: SLOT_COUNT }, () => false));
  }, [actionImageType, autoMatchedKey]);

  useEffect(() => {
    if (!savedSlotsKey) return;
    const next = [...savedSlots!].slice(0, SLOT_COUNT);
    setSlots((prev) =>
      elementImageSlotsFingerprint(prev) === savedSlotsKey ? prev : next
    );
    setManualMask(deriveManualMaskForElementSlots(savedSlots!, autoMatched, SLOT_COUNT));
  }, [savedSlotsKey, savedSlots, autoMatchedKey]);

  // Chỉ chạy khi nguồn auto-match đổi — không chạy lại theo manualMask
  // (tránh race ghi đè slot vừa gắn từ parent).
  useEffect(() => {
    setSlots((prev) => {
      const mask = manualMaskRef.current;
      const next = autoMatched.map((img, i) => (mask[i] ? prev[i] : img));
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(next)
        ? prev
        : next;
    });
  }, [autoMatchedKey, autoMatched]);

  useSceneElementImagesRowNotify(sceneId, slots, manualMask, onSlotsChange);

  /** Parent (assign/card/list) là nguồn sự thật khi đã có ảnh — tránh race state nội bộ làm slot trống. */
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
    <div className="relative shrink-0">
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
          />
        ))}
      </div>
    </div>
  );
}
