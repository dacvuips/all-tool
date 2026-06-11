/**
 * Hàng ô ảnh tham chiếu theo scene.
 * - slotSource=prompt: auto-match tên ảnh trong prompt (tab Thành phần).
 * - slotSource=artStyleImg: gán theo tên file số (Images to Video), không dùng prompt.
 *   imageOnly: cảnh N → ảnh N; startEnd: cảnh N → ảnh (2N-1), (2N).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ElementFormConfig, ElementFormImage } from "../../../constants";
import { getSceneImageSlotCount } from "../../utils/elementFormImageUtils";
import {
  matchArtStyleImagesForScene,
  matchElementImagesInPrompt,
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
  const slotCount = getSceneImageSlotCount(elementFormConfig?.serviceImageType);
  const autoMatched = useMemo(() => {
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

  const [slots, setSlots] = useState<(ElementFormImage | undefined)[]>(() =>
    trimSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched], slotCount)
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: slotCount }, () => false)
  );
  const lastNotifiedRef = useRef<string>("");

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
    setSlots(trimSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched], slotCount));
    setManualMask(Array.from({ length: slotCount }, () => false));
    lastNotifiedRef.current = "";
  }, [sceneId, slotCount]);

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
      const next = autoMatched.map((img, i) => (manualMask[i] ? prev[i] : img));
      return trimSlots(next, slotCount);
    });
  }, [autoMatched, manualMask, slotCount, slotSource, sceneNumber]);

  const notifyParent = useCallback(
    (next: (ElementFormImage | undefined)[]) => {
      // Key theo từng slot (không chỉ URL) — tránh bỏ qua sync khi đổi ảnh cùng URL / thứ tự slot
      const key = next
        .map((s, i) => {
          if (!s) return `${i}:`;
          const bytesLen = s.imageBytes?.length ?? 0;
          const url = s.fifeUrl || "";
          return `${i}:${s.name ?? ""}:${bytesLen}:${url.slice(0, 32)}`;
        })
        .join("|");
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
