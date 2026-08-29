/**
 * Hàng 1 ô video tham chiếu theo scene – auto-match tên video trong prompt.
 * Tương tự SceneElementImagesRow nhưng dành cho video, chỉ hiển thị 1 slot.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { RiVideoLine } from "react-icons/ri";
import { ElementFormConfig, ElementFormVideo } from "../../../constants";
import { matchElementVideosInPrompt } from "../../utils/matchElementVideosInPrompt";
import { SceneElementVideoSlot } from "../scene-element-video-slot";

const SLOT_COUNT = 1;

export interface SceneElementVideosRowProps {
  sceneId: string;
  prompt: string;
  elementFormConfig?: ElementFormConfig;
  savedSlots?: (ElementFormVideo | undefined)[];
  readOnly?: boolean;
  onSlotsChange: (slots: (ElementFormVideo | undefined)[]) => void;
  hideLabel?: boolean;
}

export function SceneElementVideosRow({
  sceneId,
  prompt,
  elementFormConfig,
  savedSlots,
  readOnly = false,
  onSlotsChange,
  hideLabel = false,
}: SceneElementVideosRowProps) {
  const { t } = useTranslation();

  // Auto-match: tìm video đầu tiên có tên trong prompt
  const autoMatched = useMemo(
    () => matchElementVideosInPrompt(prompt, elementFormConfig),
    [prompt, elementFormConfig]
  );

  const [slots, setSlots] = useState<(ElementFormVideo | undefined)[]>(() =>
    savedSlots?.length ? [...savedSlots] : [...autoMatched]
  );

  // manualMask[0] = true → slot 0 đã được override thủ công, không dùng auto-match
  const [manualMask, setManualMask] = useState<boolean[]>([false]);
  const lastNotifiedRef = useRef<string>("");

  // Reset khi đổi scene
  useEffect(() => {
    setSlots(savedSlots?.length ? [...savedSlots] : [...autoMatched]);
    setManualMask([false]);
    lastNotifiedRef.current = "";
  }, [sceneId]);

  // Cập nhật auto-match khi prompt thay đổi (nhưng giữ override thủ công)
  useEffect(() => {
    setSlots((prev) => {
      const next = autoMatched.map((vid, i) => (manualMask[i] ? prev[i] : vid));
      return next;
    });
  }, [autoMatched, manualMask]);

  // Notify parent (debounce bằng key)
  const notifyParent = useCallback(
    (next: (ElementFormVideo | undefined)[]) => {
      const key = next
        .map((s, i) => {
          if (!s) return `${i}:`;
          const bytesLen = s.videoBytes?.length ?? 0;
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

  const handleSlotChange = useCallback((index: number, value: ElementFormVideo | undefined) => {
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

  const hasVideo = !!slots[0];

  return (
    <div className="relative">
      {!hideLabel && (
        <div className="flex justify-between items-center mb-1">
          <span className="flex items-center gap-1 text-xs font-bold tracking-wide text-violet-600 uppercase">
            <RiVideoLine className="text-sm" />
            {t("Video tham chiếu")}:
          </span>
        </div>
      )}

      <div className="flex gap-2 mt-0.5">
        <SceneElementVideoSlot
          value={slots[0]}
          readOnly={readOnly}
          onChange={(v) => handleSlotChange(0, v)}
          videoClass="w-24 h-16"
        />
      </div>
    </div>
  );
}
