/**
 * Hàng ô ảnh tham chiếu theo scene (Images to Video).
 *
 * - ActionImageEnum.auto: match artStyleImg theo tên file số (luồng gốc).
 *   imageOnly: cảnh N → ảnh N; startEnd/startAddEnd: cảnh N → ảnh (2N-1), (2N).
 * - ActionImageEnum.sequential: mỗi nhóm ảnh sidebar → 1 slot, trải đều theo danh sách cảnh.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../../constants";
import { ActionImageEnum } from "../../constants";
import { resolveActionImageType, sequentialImagesFingerprint } from "../../utils/elementActionImageUtils";
import { getSceneImageSlotCount } from "../../utils/elementFormImageUtils";
import {
  deriveManualMaskForElementSlots,
  elementImageSlotsFingerprint,
  ElementImageSlotsChangeHandler,
  resolveSlotsFromCatalog,
  slotHasDisplayMedia,
} from "../../utils/elementImageSlotPersist";
import {
  matchArtStyleImagesForScene,
  matchElementImagesInPrompt,
  matchSequentialElementImagesForScene,
} from "../../utils/matchElementImagesInPrompt";
import { useSceneElementImagesRowNotify } from "../useSceneElementImagesRowNotify";
import { SceneElementImageSlot } from "../scene-element-image-slot";

function trimSlots(
  slots: (ElementFormImage | undefined)[],
  slotCount: number
): (ElementFormImage | undefined)[] {
  const next = [...slots];
  while (next.length < slotCount) next.push(undefined);
  return next.slice(0, slotCount);
}

export type SceneElementImageSlotSource = "prompt" | "artStyleImg";

export interface SceneElementImagesRowProps {
  sceneId: string;
  sceneNumber: number;
  prompt: string;
  elementFormConfig?: ElementFormConfig;
  /** prompt: match tên trong prompt; artStyleImg: artStyleImg theo tên số file */
  slotSource?: SceneElementImageSlotSource;
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
  slotSource = "prompt",
  savedSlots,
  readOnly = false,
  onSlotsChange,
  hideLabel = false,
}: SceneElementImagesRowProps) {
  const { t } = useTranslation();
  const actionImageType = resolveActionImageType(elementFormConfig);
  const isSequentialImageMode = actionImageType === ActionImageEnum.sequential;
  const slotCount = getSceneImageSlotCount(elementFormConfig?.serviceImageType);

  const sequentialImagesKey = useMemo(
    () => sequentialImagesFingerprint(elementFormConfig?.artStyleImgSequential),
    [elementFormConfig?.artStyleImgSequential]
  );

  const autoModeMatched = useMemo(() => {
    const matched =
      slotSource === "artStyleImg"
        ? matchArtStyleImagesForScene(
            sceneNumber,
            elementFormConfig?.serviceImageType,
            elementFormConfig
          )
        : matchElementImagesInPrompt(prompt, elementFormConfig);
    return trimSlots(matched, slotCount);
  }, [slotSource, sceneNumber, prompt, elementFormConfig, slotCount]);

  const sequentialMatched = useMemo(
    () =>
      trimSlots(
        matchSequentialElementImagesForScene(
          sceneNumber,
          elementFormConfig?.artStyleImgSequential,
          slotCount
        ),
        slotCount
      ),
    [sceneNumber, elementFormConfig?.artStyleImgSequential, slotCount, sequentialImagesKey]
  );

  const resolvedMatched = isSequentialImageMode ? sequentialMatched : autoModeMatched;
  const resolvedMatchedKey = useMemo(
    () => elementImageSlotsFingerprint(resolvedMatched),
    [resolvedMatched]
  );

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    trimSlots(savedSlots?.length ? [...savedSlots] : [...resolvedMatched], slotCount)
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: slotCount }, () => false)
  );
  const prevActionImageTypeRef = useRef(actionImageType);

  const manualMaskRef = useRef(manualMask);
  manualMaskRef.current = manualMask;

  const savedSlotsKey = useMemo(
    () => (savedSlots?.length ? elementImageSlotsFingerprint(savedSlots) : ""),
    [savedSlots]
  );

  useEffect(() => {
    setSlots(trimSlots(savedSlots?.length ? [...savedSlots] : [...resolvedMatched], slotCount));
    setManualMask(
      savedSlots?.length
        ? deriveManualMaskForElementSlots(savedSlots, resolvedMatched, slotCount)
        : Array.from({ length: slotCount }, () => false)
    );
    prevActionImageTypeRef.current = actionImageType;
  }, [sceneId, slotCount]);

  useEffect(() => {
    if (prevActionImageTypeRef.current === actionImageType) return;
    prevActionImageTypeRef.current = actionImageType;
    const next = trimSlots([...resolvedMatched], slotCount);
    setSlots(next);
    setManualMask(Array.from({ length: slotCount }, () => false));
  }, [actionImageType, resolvedMatched, resolvedMatchedKey, slotCount]);

  useEffect(() => {
    if (!savedSlotsKey) return;
    const next = trimSlots([...savedSlots!], slotCount);
    setSlots((prev) => {
      if (elementImageSlotsFingerprint(prev) === savedSlotsKey) return prev;
      return next;
    });
    setManualMask(deriveManualMaskForElementSlots(savedSlots!, resolvedMatched, slotCount));
  }, [savedSlotsKey, slotCount, savedSlots, resolvedMatchedKey]);

  useEffect(() => {
    setSlots((prev) => trimSlots(prev, slotCount));
    setManualMask((mask) => {
      const next = [...mask];
      while (next.length < slotCount) next.push(false);
      return next.slice(0, slotCount);
    });
  }, [slotCount]);

  // Chỉ khi nguồn auto-match đổi — tránh race ghi đè slot vừa gắn.
  useEffect(() => {
    setSlots((prev) => {
      const mask = manualMaskRef.current;
      const next = trimSlots(
        resolvedMatched.map((img, i) => (mask[i] ? prev[i] : img)),
        slotCount
      );
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(next)
        ? prev
        : next;
    });
  }, [resolvedMatchedKey, resolvedMatched, slotCount]);

  useSceneElementImagesRowNotify(sceneId, slots, manualMask, onSlotsChange);

  /** Parent (assign/card/list) là nguồn sự thật khi đã có ảnh — tránh race state nội bộ làm slot trống. */
  const displaySlots = useMemo(() => {
    const merged = Array.from({ length: slotCount }, (_, i) => {
      const saved = savedSlots?.[i];
      const local = slots[i];
      const savedHasMedia = slotHasDisplayMedia(saved);
      const localHasMedia = slotHasDisplayMedia(local);
      if (savedHasMedia) return saved;
      if (localHasMedia) return local;
      return saved ?? local ?? resolvedMatched[i];
    });
    return resolveSlotsFromCatalog(merged, elementFormConfig);
  }, [savedSlots, slots, elementFormConfig, resolvedMatched, resolvedMatchedKey, slotCount]);

  const handleSlotChange = useCallback(
    (index: number, value: ElementFormImage | undefined) => {
      setManualMask((mask) => {
        const nextMask = [...mask];
        nextMask[index] = true;
        return nextMask;
      });
      setSlots((prev) => {
        const next = [...prev];
        next[index] = value;
        return trimSlots(next, slotCount);
      });
    },
    [slotCount]
  );

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
              {t("Đã gắn")} {filledCount}/{slotCount}
            </span>
          )}
        </div>
      )}
      <div className="mt-1 flex flex-nowrap gap-2">
        {Array.from({ length: slotCount }, (_, i) => (
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
