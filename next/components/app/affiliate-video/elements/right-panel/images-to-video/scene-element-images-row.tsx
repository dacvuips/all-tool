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
  matchArtStyleImagesForScene,
  matchElementImagesInPrompt,
  matchSequentialElementImagesForScene,
} from "../../utils/matchElementImagesInPrompt";
import { SceneElementImageSlot } from "../scene-element-image-slot";

function trimSlots(
  slots: (ElementFormImage | undefined)[],
  slotCount: number
): (ElementFormImage | undefined)[] {
  const next = [...slots];
  while (next.length < slotCount) next.push(undefined);
  return next.slice(0, slotCount);
}

function slotsFingerprint(slots: (ElementFormImage | undefined)[]): string {
  return slots
    .map((s, i) => {
      if (!s) return `${i}:`;
      return `${i}:${s.name ?? ""}:${s.imageBytes?.length ?? 0}:${(s.fifeUrl || "").slice(0, 32)}`;
    })
    .join("|");
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
  onSlotsChange: (slots: (ElementFormImage | undefined)[]) => void;
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

  /** Luồng gốc — auto: artStyleImg theo tên file số (Images to Video). */
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

  /** Luồng mới — sequential: trải đều ảnh theo nhóm sidebar. */
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
    () => slotsFingerprint(resolvedMatched),
    [resolvedMatched]
  );

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    trimSlots(savedSlots?.length ? [...savedSlots] : [...resolvedMatched], slotCount)
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: slotCount }, () => false)
  );
  const lastNotifiedRef = useRef<string>("");
  const prevActionImageTypeRef = useRef(actionImageType);

  const savedSlotsKey = useMemo(
    () =>
      savedSlots
        ?.map((s, i) => {
          if (!s) return `${i}:`;
          return `${i}:${s.name ?? ""}:${s.imageBytes?.length ?? 0}:${(s.fifeUrl || "").slice(0, 32)}`;
        })
        .join("|") ?? "",
    [savedSlots]
  );

  useEffect(() => {
    setSlots(trimSlots(savedSlots?.length ? [...savedSlots] : [...resolvedMatched], slotCount));
    setManualMask(Array.from({ length: slotCount }, () => false));
    lastNotifiedRef.current = "";
  }, [sceneId, slotCount]);

  useEffect(() => {
    if (prevActionImageTypeRef.current === actionImageType) return;
    prevActionImageTypeRef.current = actionImageType;
    const next = trimSlots([...resolvedMatched], slotCount);
    setSlots(next);
    setManualMask(Array.from({ length: slotCount }, () => false));
    lastNotifiedRef.current = slotsFingerprint(next);
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
    lastNotifiedRef.current = "";
  }, [slotCount]);

  useEffect(() => {
    setSlots((prev) => {
      const next = trimSlots(
        resolvedMatched.map((img, i) => (manualMask[i] ? prev[i] : img)),
        slotCount
      );
      return slotsFingerprint(prev) === slotsFingerprint(next) ? prev : next;
    });
  }, [resolvedMatchedKey, manualMask, resolvedMatched, slotCount]);

  const notifyParent = useCallback(
    (next: (ElementFormImage | undefined)[]) => {
      const key = slotsFingerprint(next);
      if (key === lastNotifiedRef.current) return;
      lastNotifiedRef.current = key;
      onSlotsChange(next);
    },
    [onSlotsChange]
  );

  useEffect(() => {
    notifyParent(slots);
  }, [slots, notifyParent]);

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
            value={slots[i]}
            readOnly={readOnly}
            onChange={(v) => handleSlotChange(i, v)}
          />
        ))}
      </div>
    </div>
  );
}
