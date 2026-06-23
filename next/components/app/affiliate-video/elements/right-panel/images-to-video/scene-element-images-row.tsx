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
  elementImageSlotsFingerprint,
  ElementImageSlotsChangeHandler,
  resolveSlotsFromCatalog,
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

  const savedSlotsKey = useMemo(
    () => (savedSlots?.length ? elementImageSlotsFingerprint(savedSlots) : ""),
    [savedSlots]
  );

  useEffect(() => {
    setSlots(trimSlots(savedSlots?.length ? [...savedSlots] : [...resolvedMatched], slotCount));
    setManualMask(
      savedSlots?.length
        ? Array.from({ length: slotCount }, (_, i) => !!savedSlots[i])
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
    if (!savedSlots?.length) return;
    setSlots(trimSlots([...savedSlots], slotCount));
    setManualMask(Array.from({ length: slotCount }, (_, i) => !!savedSlots[i]));
  }, [savedSlotsKey, slotCount]);

  useEffect(() => {
    setSlots((prev) => trimSlots(prev, slotCount));
    setManualMask((mask) => {
      const next = [...mask];
      while (next.length < slotCount) next.push(false);
      return next.slice(0, slotCount);
    });
  }, [slotCount]);

  const manualMaskKey = manualMask.map(String).join(",");

  useEffect(() => {
    setSlots((prev) => {
      const next = trimSlots(
        resolvedMatched.map((img, i) => (manualMask[i] ? prev[i] : img)),
        slotCount
      );
      return elementImageSlotsFingerprint(prev) === elementImageSlotsFingerprint(next) ? prev : next;
    });
  }, [resolvedMatchedKey, manualMaskKey, resolvedMatched, slotCount]);

  useSceneElementImagesRowNotify(sceneId, slots, manualMask, onSlotsChange);

  const displaySlots = useMemo(
    () => resolveSlotsFromCatalog(slots, elementFormConfig),
    [slots, elementFormConfig, resolvedMatchedKey]
  );

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
      <div className="flex gap-2 mt-1">
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
