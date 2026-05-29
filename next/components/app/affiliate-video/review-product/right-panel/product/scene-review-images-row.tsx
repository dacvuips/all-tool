/**
 * Hàng 3 ô ảnh tham chiếu theo scene – auto-match tên ảnh trong prompt (tối đa 3, theo thứ tự xuất hiện).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

import { ReviewFormConfig, ReviewFormImage } from "../../constants";
import { matchReviewImagesInPrompt } from "../../utils/matchElementImagesInPrompt";
import { SceneReviewImageSlot } from "../scene-review-image-slot";

const SLOT_COUNT = 3;

export interface SceneReviewImagesRowProps {
  sceneId: string;
  prompt: string;
  reviewFormConfig?: ReviewFormConfig;
  savedSlots?: (ReviewFormImage | undefined)[];
  readOnly?: boolean;
  onSlotsChange: (slots: (ReviewFormImage | undefined)[]) => void;
}

export function SceneReviewImagesRow({
  sceneId,
  prompt,
  reviewFormConfig,
  savedSlots,
  readOnly = false,
  onSlotsChange,
}: SceneReviewImagesRowProps) {
  const { t } = useTranslation();

  const autoMatched = useMemo(
    () => matchReviewImagesInPrompt(prompt, reviewFormConfig),
    [prompt, reviewFormConfig]
  );

  const [slots, setSlots] = useState<(ReviewFormImage | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );
  const [manualMask, setManualMask] = useState<boolean[]>(() =>
    Array.from({ length: SLOT_COUNT }, () => false)
  );
  const lastNotifiedRef = useRef<string>("");

  useEffect(() => {
    setSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched]);
    setManualMask(Array.from({ length: SLOT_COUNT }, () => false));
    lastNotifiedRef.current = "";
  }, [sceneId]);

  useEffect(() => {
    setSlots((prev) => {
      const next = autoMatched.map((img, i) => (manualMask[i] ? prev[i] : img));
      return next;
    });
  }, [autoMatched, manualMask]);

  const notifyParent = useCallback(
    (next: (ReviewFormImage | undefined)[]) => {
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

  const handleSlotChange = useCallback((index: number, value: ReviewFormImage | undefined) => {
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
          <SceneReviewImageSlot
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
